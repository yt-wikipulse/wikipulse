#!/usr/bin/env python3
"""
Ингестор: читает поток правок Wikimedia (SSE) и складывает отфильтрованные
события в очередь ``q_raw``.

Работает бесконечно и переживает обрывы: соединение с таймаутом 90 секунд,
пауза 5 секунд после сетевой ошибки и 10 секунд после ошибки YTsaurus.
Позиция в потоке — заголовок ``Last-Event-ID``, он живёт только в памяти
процесса, поэтому рестарт продолжает чтение с текущего момента, а не
с последнего обработанного события.
"""
import json
import time
import logging

import requests
import yt.wrapper as yt

from bigdata.paths import Q_RAW
from bigdata.runtime import USER_AGENT

SSE_URL = "https://stream.wikimedia.org/v2/stream/recentchange"
BATCH_SIZE = 100
"""
Размер пачки для ``insert_rows``. Строки копятся в памяти и пишутся
с ``durability="sync"``: незаписанная пачка теряется при падении процесса,
записанная — уже на диске.
"""


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("ingestor")

def normalize_title(title: str) -> str:
    return title.replace("_", " ").strip()

def event_to_row(evt: dict) -> dict | None:
    """
    Приводит событие потока к строке ``q_raw`` или возвращает ``None``, если
    событие отфильтровано: боты, служебные вики, ненулевое пространство имён,
    типы кроме ``edit`` и ``new``, события без номера новой ревизии.
    """
    wiki = evt.get("wiki", "")

    bot = evt.get("bot", False)

    if bot:
        return None

    if not wiki.endswith("wiki"):
        return None
    if wiki in ("wikidatawiki", "commonswiki", "metawiki", "abstractwiki"):
        return None
    lang_part = wiki[:-4]
    if not lang_part:
        return None

    if evt.get("namespace") != 0:
        return None

    evt_type = evt.get("type", "")
    if evt_type not in ("edit", "new"):
        return None

    revision = evt.get("revision", {})
    rev_new = revision.get("new")
    if rev_new is None:
        return None

    length = evt.get("length", {})

    return {
        "event_id": f"{wiki}|{rev_new}",
        "wiki":     wiki,
        "title":    normalize_title(evt.get("title", "")),
        "url":      evt.get("title_url", ""),
        "event_ts": int(evt.get("timestamp", 0)),
        "length_update": length.get("new", 0) - length.get("old", 0),
        "diff_url": evt.get("notify_url", ""),
    }


def stream_sse(url: str, last_event_id: str | None = None):
    headers = {
        "Accept": "text/event-stream",
        "User-Agent": USER_AGENT,
    }
    if last_event_id:
        headers["Last-Event-ID"] = last_event_id

    with requests.get(url, headers=headers, stream=True, timeout=90) as resp:
        resp.raise_for_status()
        event_id = None
        data_lines = []

        for line in resp.iter_lines(decode_unicode=True):
            if line is None:
                continue
            if line == "":
                if data_lines:
                    payload = "\n".join(data_lines)
                    try:
                        evt = json.loads(payload)
                        yield event_id, evt
                    except json.JSONDecodeError:
                        log.warning("битый JSON, пропускаю")
                    data_lines = []
                    event_id = None
            elif line.startswith("id:"):
                event_id = line[3:].strip()
            elif line.startswith("data:"):
                data_lines.append(line[5:].strip())


def main():
    sse_url = SSE_URL
    q_raw = Q_RAW
    batch_size = BATCH_SIZE

    last_event_id = None
    batch = []
    stats = {"in": 0, "out": 0, "filtered": 0}

    log.info("Ингестор стартовал (MVP, все вики)")
    log.info("  SSE:    %s", sse_url)
    log.info("  Q_RAW:  %s", q_raw)
    log.info("  Batch:  %d строк", batch_size)
    log.info("-" * 60)

    while True:
        try:
            for event_id, evt in stream_sse(sse_url, last_event_id):
                last_event_id = event_id
                stats["in"] += 1

                row = event_to_row(evt)
                if row is None:
                    stats["filtered"] += 1
                    continue

                batch.append(row)
                stats["out"] += 1

                if len(batch) >= batch_size:
                    yt.insert_rows(q_raw, batch, durability="sync")
                    log.info(
                        "записано %d | in=%d out=%d filtered=%d | last=%s",
                        len(batch), stats["in"], stats["out"],
                        stats["filtered"], (last_event_id or "")[:50],
                    )
                    batch = []

        except (requests.exceptions.ConnectionError,
                requests.exceptions.Timeout,
                requests.exceptions.ChunkedEncodingError) as e:
            log.warning("SSE обрыв: %s. Реконнект через 5 сек...", e)
            time.sleep(5)
        except yt.YtError as e:
            log.error("Ошибка YTsaurus: %s. Повтор через 10 сек...", e)
            time.sleep(10)
        except Exception as e:
            log.exception("Непредвиденная ошибка: %s. Рестарт через 10 сек", e)
            time.sleep(10)


if __name__ == "__main__":
    main()
