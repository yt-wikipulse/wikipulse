#!/usr/bin/env python3
"""
Запуск:
    source ~/a-summer-school
    uv run load-dict-coords-full

Ограничить для теста:
    uv run load-dict-coords-full --max-rows 10000
"""
import json
import time
import logging
import argparse

import requests
import yt.wrapper as yt

from bigdata.config_loader import paths

DUMP_URL = "https://dumps.wikimedia.org/wikidatawiki/entities/latest-all.json.gz"
BATCH_SIZE = 10000

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("load_coords_full")


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
        entity = json.loads(line)
    except json.JSONDecodeError:
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

        rows.append({
            "wiki":  wiki,
            "title": title,
            "lat":   lat,
            "lon":   lon,
        })

    return rows


def stream_dump(max_rows: int | None = None):
    log.info("Открываю поток: %s", DUMP_URL)

    headers = {
        "User-Agent": "WikiPulse/0.1 (https://github.com/wikpulse; contact@wikpulse.org)",
    }
    import gzip
    response = requests.get(DUMP_URL, headers=headers, stream=True, timeout=60)
    response.raise_for_status()
    decompressed = gzip.GzipFile(fileobj=response.raw)

    batch = []
    total_in = 0
    total_out = 0
    total_skipped = 0

    for raw_line in decompressed:
        total_in += 1

        rows = parse_entity(raw_line.decode("utf-8", errors="ignore"))
        if not rows:
            total_skipped += 1
        else:
            batch.extend(rows)
            total_out += len(rows)

        if total_in % 100000 == 0:
            log.info(
                "прочитано %d элементов | строк: %d | пропущено без гео: %d",
                total_in, total_out, total_skipped,
            )

        if len(batch) >= BATCH_SIZE:
            yield batch, total_in, total_out, total_skipped
            batch = []

        if max_rows and total_out >= max_rows:
            log.info("Достигнут лимит --max-rows %d, останавливаюсь", max_rows)
            if batch:
                yield batch, total_in, total_out, total_skipped
            return

    if batch:
        yield batch, total_in, total_out, total_skipped


def main():
    parser = argparse.ArgumentParser(description="Загрузка всех координат из дампа Wikidata")
    parser.add_argument("--max-rows", type=int, default=None,
                        help="Максимум строк (для теста). Без лимита — весь дамп.")
    args = parser.parse_args()

    dict_coords_path = paths.dict_coords
    tmp_path = f"{paths.base_dir}/dict/coords_tmp"

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
            log.info(
                "записано %d строк во tmp | элементов: %d | скорость: %.0f строк/сек | время: %ds",
                total_out, total_in, rate, int(elapsed),
            )
            last_log = now

    elapsed = time.time() - start_time
    log.info("=" * 60)
    log.info("Стрим завершён. Строк во временной таблице: %d", total_written)
    log.info("Время стрима: %d сек (%.1f мин)", int(elapsed), elapsed / 60)

    log.info("-" * 60)
    log.info("Сортировка %s → %s (на кластере)...", tmp_path, dict_coords_path)

    if yt.exists(dict_coords_path):
        yt.remove(dict_coords_path)

    sorted_schema = [
        {"name": "wiki",  "type": "string", "sort_order": "ascending"},
        {"name": "title", "type": "string", "sort_order": "ascending"},
        {"name": "lat",   "type": "double"},
        {"name": "lon",   "type": "double"},
    ]
    yt.create("table", dict_coords_path, attributes={"schema": sorted_schema}, recursive=True)

    yt.run_sort(tmp_path, dict_coords_path, sort_by=["wiki", "title"])

    yt.remove(tmp_path)

    final_count = yt.get(f"{dict_coords_path}/@row_count")
    log.info("✅ Готово! Строк в dict/coords: %s", final_count)
    log.info("Проверь: yt read-table %s --format json", dict_coords_path)


if __name__ == "__main__":
    main()
