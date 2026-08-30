#!/usr/bin/env python3
"""
Архиватор: переливает ``q_enriched`` в статическую таблицу ``t_history``,
из которой считаются витрины.

Курсор хранится в атрибуте ``t_history/@archiver_last_row_index``, а не
в консьюмере очереди, поэтому ``c_archive`` не двигается и автотрим
``q_enriched`` фактически не срабатывает: очередь растёт, но данные
не теряются. Курсор пишется после успешной записи страницы, то есть
доставка at-least-once — дедуп по ``event_id`` делает ``spyt_marts``.
"""
import logging

import yt.wrapper as yt

from bigdata.paths import Q_ENRICHED, T_HISTORY
from bigdata.runtime import require_env

CURSOR_ATTR = "archiver_last_row_index"
PAGE_SIZE = 5000


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("archiver")


def read_cursor() -> int:
    """Последний заархивированный ``$row_index``; 0, если атрибута ещё нет."""
    path = f"{T_HISTORY}/@{CURSOR_ATTR}"
    if not yt.exists(path):
        return 0
    return int(yt.get(path))


def write_cursor(value: int):
    yt.set(f"{T_HISTORY}/@{CURSOR_ATTR}", value)


def fetch_page(cursor: int, limit: int) -> list[dict]:
    query = (
        f"[$row_index] as row_index, event_id, title, url, h3_r9, event_ts, "
        f"length_update, diff_url "
        f"from [{Q_ENRICHED}] where [$row_index] > {cursor} limit {limit}"
    )
    return list(yt.select_rows(query))


def main():
    require_env("YT_PROXY", "YT_TOKEN")

    cursor = read_cursor()
    total = 0

    log.info("Архиватор стартовал: %s → %s | курсор %d", Q_ENRICHED, T_HISTORY, cursor)
    log.info("-" * 60)

    while True:
        page = fetch_page(cursor, PAGE_SIZE)
        if not page:
            break

        rows = [
            {
                "event_id": r["event_id"],
                "title":    r["title"],
                "url":      r["url"],
                "h3_r9":    r["h3_r9"],
                "event_ts": int(r["event_ts"]),
                "length_update": int(r["length_update"]),
                "diff_url":      r["diff_url"],
            }
            for r in page
        ]
        yt.write_table(yt.TablePath(T_HISTORY, append=True), rows)

        cursor = max(int(r["row_index"]) for r in page)
        write_cursor(cursor)
        total += len(rows)
        log.info("заархивировано %d | всего %d | курсор %d", len(rows), total, cursor)

    log.info("=" * 60)
    log.info("Готово: %d строк, курсор %d", total, cursor)


if __name__ == "__main__":
    main()
