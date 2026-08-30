#!/usr/bin/env python3
import json
import gzip
import time
import logging
import argparse

import requests
import yt.wrapper as yt
from yt import yson

from pathlib import Path

from bigdata.paths import DICT_COORDS, DICT_COORDS_TMP
from bigdata.runtime import USER_AGENT

DUMP_URL = "https://dumps.wikimedia.org/wikidatawiki/entities/latest-all.json.gz"
BATCH_SIZE = 50000

try:
    import orjson
    _loads = orjson.loads
    _JSON_LIB = "orjson"
except ImportError:
    _loads = json.loads
    _JSON_LIB = "stdlib"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("load_coords")

_P625 = b'"P625"'


def get_coords(claims: dict) -> tuple[float, float] | None:
    stmts = claims.get("P625", [])
    if not stmts:
        return None
    try:
        val = stmts[0]["mainsnak"]["datavalue"]["value"]
        return float(val["latitude"]), float(val["longitude"])
    except (KeyError, IndexError, TypeError, ValueError):
        return None


def parse_entity(line: str) -> list[dict]:
    line = line.strip().rstrip(",")
    if not line or line in ("[", "]"):
        return []

    try:
        entity = _loads(line)
    except (ValueError, json.JSONDecodeError):
        return []

    claims = entity.get("claims", {})
    coords = get_coords(claims)
    if coords is None:
        return []

    lat, lon = coords
    rows = []
    sitelinks = entity.get("sitelinks", {})
    for wiki, sl in sitelinks.items():
        if not wiki.endswith("wiki"):
            continue
        if wiki in ("wikidatawiki", "commonswiki", "metawiki", "abstractwiki"):
            continue
        lang_part = wiki[:-4]
        if not lang_part:
            continue

        title = sl.get("title", "").replace("_", " ").strip()
        if not title:
            continue

        rows.append({"wiki": wiki, "title": title, "lat": lat, "lon": lon})

    return rows

def stream_dump(max_rows: int | None = None):
    log.info("Открываю поток: %s", DUMP_URL)
    log.info("JSON парсер: %s", _JSON_LIB)

    headers = {"User-Agent": USER_AGENT}
    response = requests.get(DUMP_URL, headers=headers, stream=True, timeout=120)
    response.raise_for_status()
    decompressed = gzip.GzipFile(fileobj=response.raw)

    batch = []
    total_in = 0
    total_out = 0
    total_skipped = 0
    total_p625 = 0

    for raw_line in decompressed:
        total_in += 1

        if _P625 not in raw_line:
            total_skipped += 1
            continue

        total_p625 += 1

        rows = parse_entity(raw_line.decode("utf-8", errors="ignore"))
        if not rows:
            total_skipped += 1
            continue

        batch.extend(rows)
        total_out += len(rows)

        if total_in % 500000 == 0:
            hit_rate = total_p625 / total_in * 100 if total_in else 0
            log.info(
                "сущностей: %dK | P625: %d (%.1f%%) | строк: %d",
                total_in // 1000, total_p625, hit_rate, total_out,
            )

        if len(batch) >= BATCH_SIZE:
            yield batch, total_in, total_out, total_skipped
            batch = []

        if max_rows and total_out >= max_rows:
            log.info("Лимит --max-rows %d достигнут", max_rows)
            if batch:
                yield batch, total_in, total_out, total_skipped
            return

    if batch:
        yield batch, total_in, total_out, total_skipped



REDUCER_PATH = Path(__file__).with_name("_dedup_reducer.py")

REDUCER_SOURCE = """
import sys, json
prev = None
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    row = json.loads(line)
    key = (row.get("wiki"), row.get("title"))
    if key == prev:
        continue
    prev = key
    sys.stdout.write(json.dumps(row, ensure_ascii=False))
    sys.stdout.write("\n")
"""


def unique_schema():
    """
    Схема справочника с `unique_keys=true`. Без него таблицу нельзя перевести
    в динамическую, а без динамической не работает `lookup_rows`, которым
    её читает обогащение.
    """
    schema = yson.YsonList([
        {"name": "wiki",  "type": "string", "sort_order": "ascending"},
        {"name": "title", "type": "string", "sort_order": "ascending"},
        {"name": "lat",   "type": "double"},
        {"name": "lon",   "type": "double"},
    ])
    schema.attributes["strict"] = True
    schema.attributes["unique_keys"] = True
    return schema


def _write_reducer(path):
    """
    Редьюсер кладётся рядом файлом и запускается питоном кластера, а не
    отправляется как функция: обёртка `yt.wrapper` шлёт на кластер исходники
    локального интерпретатора, и при несовпадении версий джоба падает
    на импорте `yt.wrapper`.
    """
    path.write_text(REDUCER_SOURCE.lstrip(), encoding="utf-8", newline=chr(10))


def main():
    parser = argparse.ArgumentParser(
        description="Загрузка координат из дампа Wikidata"
    )
    parser.add_argument("--max-rows", type=int, default=None,
                        help="Максимум строк (для теста). Без лимита — весь дамп.")
    args = parser.parse_args()

    dict_coords_path = DICT_COORDS
    tmp_path = DICT_COORDS_TMP

    log.info("Создаю временную таблицу: %s", tmp_path)
    tmp_schema = [
        {"name": "wiki",  "type": "string"},
        {"name": "title", "type": "string"},
        {"name": "lat",   "type": "double"},
        {"name": "lon",   "type": "double"},
    ]
    if yt.exists(tmp_path):
        yt.remove(tmp_path)
    yt.create("table", tmp_path, attributes={"schema": tmp_schema}, recursive=True)

    log.info("Стриминг дампа → %s (batch=%d)", tmp_path, BATCH_SIZE)
    log.info("-" * 60)

    start_time = time.time()
    last_log = start_time
    total_written = 0

    tmp_append_path = yt.TablePath(tmp_path, append=True)

    for batch, total_in, total_out, total_skipped in stream_dump(args.max_rows):
        yt.write_table(tmp_append_path, batch, format="json", raw=False)
        total_written = total_out

        now = time.time()
        if now - last_log > 10:
            elapsed = now - start_time
            rate = total_out / elapsed if elapsed > 0 else 0
            entity_rate = total_in / elapsed if elapsed > 0 else 0
            log.info(
                "записано %d строк | сущностей: %d (%.0f/сек) | скорость: %.0f строк/сек | %ds",
                total_out, total_in, entity_rate, rate, int(elapsed),
            )
            last_log = now

    elapsed = time.time() - start_time
    log.info("=" * 60)
    log.info("Стрим завершён. Строк: %d | Время: %d сек (%.1f мин)",
             total_written, int(elapsed), elapsed / 60)

    log.info("-" * 60)
    log.info("Сортировка %s → %s (на кластере)...", tmp_path, dict_coords_path)

    if yt.exists(dict_coords_path):
        yt.remove(dict_coords_path)

    sort_path = f"{tmp_path}_sorted"
    if yt.exists(sort_path):
        yt.remove(sort_path)
    yt.run_sort(tmp_path, sort_path, sort_by=["wiki", "title"])
    yt.remove(tmp_path)

    log.info("Дедупликация по (wiki, title) → %s...", dict_coords_path)
    yt.create("table", dict_coords_path,
              attributes={"schema": unique_schema()}, recursive=True)
    _write_reducer(REDUCER_PATH)
    yt.run_reduce(
        f"python3 {REDUCER_PATH.name}",
        sort_path,
        dict_coords_path,
        reduce_by=["wiki", "title"],
        sort_by=["wiki", "title"],
        format=yt.JsonFormat(control_attributes_mode="none"),
        local_files=[str(REDUCER_PATH)],
    )
    yt.remove(sort_path)

    log.info("Конверсия в динамическую таблицу и монтирование...")
    yt.alter_table(dict_coords_path, dynamic=True)
    yt.mount_table(dict_coords_path, sync=True)

    final_count = yt.get(f"{dict_coords_path}/@row_count")
    log.info("Готово. Строк в dict/coords: %s, tablet_state: %s",
             final_count, yt.get(f"{dict_coords_path}/@tablet_state"))


if __name__ == "__main__":
    main()
