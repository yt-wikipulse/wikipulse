#!/usr/bin/env python3
"""
WikiPulse MVP SPYT-enrich: Q_RAW → JOIN dict/coords → Q_ENRICHED.

Запускается НА кластере через spark-submit:
    spark-submit \\
      --master ytsaurus://https://your-cluster.example.com \\
      --deploy-mode cluster \\
      --num-executors 2 \\
      --conf spark.pyspark.python=/usr/bin/python3.11 \\
      --py-files yt:///home/wikipulse/lib/spyt_deps.zip \\
      jobs/spyt_enrich.py

Гарантия: idempotent receiver. event_id — ключ в Q_ENRICHED,
дубликаты перетираются (видимый exactly-once).
"""
import os
import sys

# ─── Загружаем config_loader из py-files (zip на кластере) ───
for p in sys.path:
    if p.endswith(".zip"):
        sys.path.insert(0, p)

try:
    # Локальная разработка (через uv run)
    from bigdata.config_loader import paths
except ImportError:
    # На кластере (из zip через --py-files)
    from config_loader import paths

# Пути из единого конфига
Q_RAW           = paths.q_raw
Q_ENRICHED      = paths.q_enriched
DICT_COORDS     = paths.dict_coords
CONSUMER_PATH   = paths.consumer_enrich
CHECKPOINT_PATH = paths.checkpoint_enrich

# ВАЖНО: import spyt ДО pyspark — регистрирует .yt расширения
import spyt
from spyt import spark_session

from pyspark.sql.functions import col, lit, when, isnull, expr


def main():
    with spark_session(
        num_executors=2,
        app_name="wikpulse-enrich-mvp",
        spark_conf_args={
            "spark.yt.streaming.transactional": "true",
            "spark.yt.streaming.transactional.ping_timeout": "30",
            "spark.yt.streaming.transactional.ping_interval": "10",
            "spark.streaming.stopGracefullyOnShutdown": "true",
            "spark.sql.adaptive.enabled": "false",
            "spark.memory.fraction": "0.5",
            "spark.memory.storageFraction": "0.2",
        },
    ) as spark:

        # 1. ЗАГРУЖАЕМ СПРАВОЧНИК (один раз, broadcast для быстрого JOIN)
        coords_df = spark.read.yt(DICT_COORDS)

        # 2. ЧИТАЕМ ОЧЕРЕДЬ Q_RAW (streaming)
        raw_stream = (
            spark.readStream
            .format("yt")
            .option("consumer_path", CONSUMER_PATH)
            .option("parsing_type_v3", "true")
            .load(Q_RAW)
        )

        # 3. JOIN: поток × справочник (LEFT — события без гео сохраняем)
        enriched = (
            raw_stream.alias("r")
            .join(
                spyt.broadcast(coords_df).alias("c"),
                (col("r.wiki") == col("c.wiki"))
                & (col("r.title") == col("c.title")),
                how="left",
            )
        )

        # 4. ВЫЧИСЛЯЕМ h3_r9 (упрощённый через round, без UDF)
        #    r9 ≈ 3 знака после запятой (~0.1° ≈ квартал)
        #    lat/lon участвуют в вычислении, но НЕ сохраняются —
        #    центр ячейки фронтенд вычислит сам из h3_r9 через h3-js.
        #    TODO: заменить на настоящий h3.latlng_to_h3(lat, lon, 9)
        enriched = (
            enriched
            .withColumn("h3_r9",
                when(col("c.lat").isNotNull(),
                     expr("concat(round(lat, 3), ',', round(lon, 3))"))
                .otherwise(lit(None)))
            .select(
                col("r.event_id"),
                col("r.title"),
                col("r.url"),
                col("h3_r9"),
            )
        )

        # 5. ПИШЕМ В Q_ENRICHED (streaming, idempotent)
        query = (
            enriched.writeStream
            .outputMode("append")
            .format("yt")
            .option("write_type_v3", True)
            .option("checkpointLocation", CHECKPOINT_PATH)
            .option("path", Q_ENRICHED)
            .start()
        )

        query.awaitTermination()


if __name__ == "__main__":
    main()
