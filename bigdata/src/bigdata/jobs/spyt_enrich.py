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
``YT_BASE_PATH`` и ``YT_PROXY`` — через ``spark.yarn.appMasterEnv.*``.
Executor'ам они не нужны, пути используются только в драйвере.
"""
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql import types as T

from bigdata import paths
from bigdata.runtime import load_h3, yt_client

h3 = load_h3()

INSERT_CHUNK = 50000


def enrich_batch(batch_df, batch_id):
    """
    Обрабатывает один микробатч стрима.

    Справочник читается точечным ``lookup_rows`` по ключам батча, а не
    broadcast join'ом: ``dict/coords`` — динамическая таблица на десятки
    миллионов строк, её полное чтение на каждый пятисекундный батч дороже
    сотни точечных ключей. События без координат отбрасываются.

    ``try/except`` здесь нет намеренно. Spark считает батч успешным, если
    функция вернула управление без исключения, и коммитит оффсеты: с
    перехватом ошибка YTsaurus означала бы тихую потерю событий. Цена —
    постоянная ошибка останавливает стрим целиком.
    """
    client = yt_client()

    rows = batch_df.collect()
    if not rows:
        return

    keys = [{"wiki": r["wiki"], "title": r["title"]} for r in rows]
    found = list(client.lookup_rows(paths.DICT_COORDS, keys, format="json"))

    coord_map = {}
    for c in found:
        if c:
            coord_map[(c["wiki"], c["title"])] = (c["lat"], c["lon"])

    enriched = []
    for r in rows:
        pair = coord_map.get((r["wiki"], r["title"]))
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
        client.insert_rows(paths.Q_ENRICHED, enriched[i:i + INSERT_CHUNK],
                           durability="sync", format="json")

    hit = len(enriched) / max(len(rows), 1) * 100
    print(f"[batch {batch_id}] in={len(rows)} enriched={len(enriched)} hit={hit:.0f}%")


def main():
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
        .foreachBatch(enrich_batch)
        .trigger(processingTime="5 seconds")
        .option("checkpointLocation", paths.spark_url(paths.CHECKPOINT_ENRICH))
        .start()
    )
    print("Стриминг запущен")
    print("-" * 60)

    query.awaitTermination()


if __name__ == "__main__":
    main()
