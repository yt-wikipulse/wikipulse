#!/usr/bin/env python3
"""
Обогащение: стриминг читает ``q_raw``, подтягивает координаты статьи из
справочника ``dict/coords`` и кладёт результат в ``q_enriched``.

Геокод считается здесь, а не на бэкенде: ячейка H3 — часть данных события,
и бэкенд должен получать её готовой. Резолюция всегда 9, самая мелкая
в проекте; всё, что крупнее, потребитель получает свёрткой вверх
(``cell_to_parent``), обратное направление из готовой ячейки недоступно.

Джоба запускается на кластере одиночным файлом, рядом с ней пакета нет:
``bigdata`` приезжает в ``--py-files`` архивом ``bigdata.zip``, а
``YT_BASE_PATH`` и ``YT_PROXY`` — через ``spark.yarn.appMasterEnv.*``,
то есть только драйверу. Пути и адрес прокси драйвер считает у себя
и передаёт executor'ам аргументами замыкания.
"""
import functools

from bigdata import paths
from bigdata.runtime import load_h3, proxy_url, yt_client

INSERT_CHUNK = 50000


@functools.lru_cache(maxsize=1)
def worker_h3():
    """
    ``h3`` внутри воркера Spark, один раз на процесс.

    ``load_h3`` распаковывает ``h3.zip`` из рабочего каталога джобы, поэтому
    вызывать его на каждую строку нельзя.
    """
    return load_h3()


def enrich_partition(rows, proxy: str, dict_coords: str, q_enriched: str):
    """
    Обогащает одну партицию микробатча целиком на executor'е: и точечный
    ``lookup_rows`` справочника, и вставка в очередь идут оттуда же, где
    лежат строки, а не через драйвер.

    Справочник читается ``lookup_rows`` по ключам партиции, а не broadcast
    join'ом: ``dict/coords`` — динамическая таблица на десятки миллионов
    строк, её полное чтение на каждый пятисекундный батч дороже сотни
    точечных ключей. События без координат отбрасываются.

    Пути и адрес прокси приходят аргументами, а не из ``paths``: на
    executor'е переменных окружения проекта нет, и вычислить их там нельзя.

    Возвращает одну пару «пришло, обогащено» — из них драйвер собирает
    hit rate батча, не стягивая к себе сами строки.
    """
    batch = list(rows)
    if not batch:
        return [(0, 0)]

    client = yt_client(proxy)
    h3 = worker_h3()

    keys = [{"wiki": r["wiki"], "title": r["title"]} for r in batch]
    coords = {
        (c["wiki"], c["title"]): (c["lat"], c["lon"])
        for c in client.lookup_rows(dict_coords, keys, format="json") if c
    }

    enriched = []
    for r in batch:
        pair = coords.get((r["wiki"], r["title"]))
        if pair:
            lat, lon = pair
            enriched.append({
                "event_id": r["event_id"],
                "title": r["title"],
                "url": r["url"],
                "h3_r9": h3.latlng_to_cell(lat, lon, 9),
                "event_ts": r["event_ts"],
                "length_update": r["length_update"],
                "diff_url": r["diff_url"],
            })

    for i in range(0, len(enriched), INSERT_CHUNK):
        client.insert_rows(q_enriched, enriched[i:i + INSERT_CHUNK],
                           durability="sync", format="json")

    return [(len(batch), len(enriched))]


def enrich_batch(batch_df, batch_id, proxy: str):
    """
    Обрабатывает один микробатч стрима, раздав партиции executor'ам.

    ``try/except`` здесь нет намеренно. Spark считает батч успешным, если
    функция вернула управление без исключения, и коммитит оффсеты: с
    перехватом ошибка YTsaurus означала бы тихую потерю событий. Цена —
    постоянная ошибка останавливает стрим целиком.
    """
    stats = batch_df.rdd.mapPartitions(
        functools.partial(enrich_partition,
                          proxy=proxy,
                          dict_coords=paths.DICT_COORDS,
                          q_enriched=paths.Q_ENRICHED)
    ).collect()

    total_in = sum(s[0] for s in stats)
    total_out = sum(s[1] for s in stats)
    if total_in == 0:
        return

    hit = total_out / total_in * 100
    print(f"[batch {batch_id}] in={total_in} enriched={total_out} hit={hit:.0f}%")


def main():
    from pyspark.sql import SparkSession
    from pyspark.sql import functions as F
    from pyspark.sql import types as T

    spark = SparkSession.builder.appName("wikipulse-enrich").getOrCreate()

    raw_stream = (
        spark.readStream
        .format("yt")
        .option("consumer_path", paths.CONSUMER_ENRICH)
        .load(paths.Q_RAW)
    )

    safe_stream = raw_stream.select(
        F.col("event_id").cast(T.StringType()).alias("event_id"),
        F.col("event_ts").cast(T.LongType()).alias("event_ts"),
        F.col("wiki").cast(T.StringType()).alias("wiki"),
        F.col("title").cast(T.StringType()).alias("title"),
        F.col("url").cast(T.StringType()).alias("url"),
        F.col("length_update").cast(T.LongType()).alias("length_update"),
        F.col("diff_url").cast(T.StringType()).alias("diff_url")
    )

    query = (
        safe_stream.writeStream
        .foreachBatch(functools.partial(enrich_batch, proxy=proxy_url()))
        .trigger(processingTime="5 seconds")
        .option("checkpointLocation", paths.spark_url(paths.CHECKPOINT_ENRICH))
        .start()
    )
    print("Стриминг запущен")
    print("-" * 60)

    query.awaitTermination()


if __name__ == "__main__":
    main()
