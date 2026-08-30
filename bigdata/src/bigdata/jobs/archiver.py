#!/usr/bin/env python3
"""
Архиватор: переливает ``q_enriched`` в статическую таблицу ``t_history``,
из которой считаются витрины.

Позиция чтения живёт в консьюмере ``c_archive``: страница берётся
``pull_consumer``, а после успешной записи консьюмер двигается
``advance_consumer``. Консьюмер зарегистрирован на очередь как vital,
поэтому автотрим срезает ровно то, что архиватор уже забрал.

Консьюмер двигается после записи, то есть доставка at-least-once: страница,
упавшая между записью и сдвигом, приедет второй раз. Дедуп по ``event_id``
делает ``spyt_marts``.

Партиции обходятся по очереди: ``$row_index`` нумеруется внутри таблета,
поэтому у каждой партиции свой независимый оффсет.
"""
import logging

import yt.wrapper as yt

from bigdata.paths import CONSUMER_ARCHIVE, Q_ENRICHED, T_HISTORY
from bigdata.runtime import require_env

PAGE_SIZE = 5000
ROW_INDEX = "$row_index"

HISTORY_COLUMNS = ("event_id", "title", "url", "h3_r9",
                   "event_ts", "length_update", "diff_url")


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("archiver")


def partition_count() -> int:
    """Число партиций очереди — оно же число её таблетов."""
    return int(yt.get(f"{Q_ENRICHED}/@tablet_count"))


def read_offsets() -> dict[int, int]:
    """
    Оффсеты партиций из таблицы консьюмера: индекс первой ещё не прочитанной
    строки. Таблица консьюмера — строка на партицию каждой его очереди,
    поэтому читается целиком и фильтруется на месте.
    """
    offsets = {}
    for row in yt.select_rows(f"* from [{CONSUMER_ARCHIVE}]"):
        if row["queue_path"] == Q_ENRICHED and row["offset"] is not None:
            offsets[int(row["partition_index"])] = int(row["offset"])
    return offsets


def to_history_row(row: dict) -> dict:
    """
    Строка очереди без служебных колонок: ``pull_consumer`` возвращает
    ``$row_index`` и ``$tablet_index``, которых в схеме ``t_history`` нет.
    """
    return {name: row[name] for name in HISTORY_COLUMNS}


def archive_partition(partition: int, offset: int) -> tuple[int, int]:
    """
    Переливает партицию до конца страницами по ``PAGE_SIZE``.

    Новый оффсет считается по ``$row_index`` последней строки, а не
    прибавлением их числа: подрезанное начало очереди отдаст страницу,
    начинающуюся дальше запрошенного места, и счётчик разошёлся бы
    с реальным положением в очереди.

    Сдвиг идёт с проверкой прежнего оффсета: если консьюмера подвинул
    кто-то ещё, запрос отбивается конфликтом, а не затирает чужую позицию
    молча. Общей транзакции с записью в архив нет и быть не может —
    ``t_history`` статическая, — поэтому сдвиг остаётся отдельной операцией
    после успешной записи.

    Возвращает число перелитых строк и оффсет, на котором остановился.
    """
    total = 0

    while True:
        page = list(yt.pull_consumer(
            CONSUMER_ARCHIVE, Q_ENRICHED,
            offset=offset, partition_index=partition,
            max_row_count=PAGE_SIZE,
        ))
        if not page:
            return total, offset

        yt.write_table(yt.TablePath(T_HISTORY, append=True),
                       [to_history_row(row) for row in page])

        new_offset = max(int(row[ROW_INDEX]) for row in page) + 1
        yt.advance_consumer(CONSUMER_ARCHIVE, Q_ENRICHED, partition,
                            offset, new_offset)

        offset = new_offset
        total += len(page)
        log.info("партиция %d: +%d строк | оффсет %d", partition, len(page), offset)


def main():
    require_env("YT_PROXY", "YT_TOKEN")

    partitions = partition_count()
    offsets = read_offsets()
    total = 0

    log.info("Архиватор стартовал: %s → %s", Q_ENRICHED, T_HISTORY)
    log.info("Консьюмер %s, партиций %d", CONSUMER_ARCHIVE, partitions)
    log.info("-" * 60)

    for partition in range(partitions):
        moved, offset = archive_partition(partition, offsets.get(partition, 0))
        total += moved
        log.info("партиция %d: %d строк, оффсет %d", partition, moved, offset)

    log.info("=" * 60)
    log.info("Готово: %d строк", total)


if __name__ == "__main__":
    main()
