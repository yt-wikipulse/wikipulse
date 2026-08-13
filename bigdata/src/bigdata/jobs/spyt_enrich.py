#!/usr/bin/env python3
"""
spark-submit \
  --master ytsaurus://https://your-cluster.example.com \
  --deploy-mode cluster \
  --num-executors 1 --executor-memory 1g --executor-cores 1 \
  --driver-memory 2g \
  --conf spark.hadoop.yt.proxy.role=http \
  --conf spark.yarn.appMasterEnv.YT_TOKEN=$YT_TOKEN \
  --conf spark.yarn.appMasterEnv.YT_PROXY=your-cluster.example.com \
  --conf spark.pyspark.python=/usr/bin/python3.11 \
  --py-files yt:///home/wikipulse/lib/spyt_deps.zip \
  --files yt:///home/wikipulse/lib/h3.zip \
  yt:///home/wikipulse/src/spyt_enrich.py

"""



import os
import sys
import zipfile

if not os.path.exists("/tmp/h3_extracted"):
    if os.path.exists("h3.zip"):
        with zipfile.ZipFile("h3.zip", 'r') as zip_ref:
            zip_ref.extractall("/tmp/h3_extracted")

sys.path.insert(0, "/tmp/h3_extracted")

import h3
import yt.wrapper as yt
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql import types as T

BASE = "//home/wikipulse"
Q_RAW       = f"{BASE}/q_raw"
Q_ENRICHED  = f"{BASE}/q_enriched"
DICT_COORDS = f"{BASE}/dict/coords_dyn"
CONSUMER_PATH   = f"{BASE}/consumers/c_enrich"
CHECKPOINT_PATH = f"yt:///{BASE.lstrip('/')}/checkpoints/c_enrich"
PROXY = "https://ytsaurus.tech"

_batch_count = 0
_yt_client = None

PROXY = "https://your-cluster.example.com/"

def get_yt_client():
    global _yt_client
    if _yt_client is None:
        token = os.environ.get("YT_TOKEN") or os.environ.get("YT_SECURE_VAULT_YT_TOKEN") or ""

        current_proxy = os.environ.get("YT_PROXY") or PROXY
        if not current_proxy.startswith("http"):
            current_proxy = f"https://{current_proxy}"

        _yt_client = yt.YtClient(proxy=current_proxy, token=token)
    return _yt_client

def enrich_batch(batch_df, batch_id):
    global _batch_count
    client = get_yt_client()

    rows = batch_df.collect()
    if not rows:
        return

    keys = [{"wiki": r["wiki"], "title": r["title"]} for r in rows]
    try:
        found = list(client.lookup_rows(DICT_COORDS, keys, format="json"))
    except Exception as e:
        print(f"[batch {batch_id}] lookup error: {e}")
        return

    coord_map = {}
    for c in found:
        if c:
            coord_map[(c["wiki"], c["title"])] = (c["lat"], c["lon"])

    enriched = []
    for r in rows:
        pair = coord_map.get((r["wiki"], r["title"]))
        if pair:
            lat, lon = pair
            h3_index = h3.latlng_to_cell(lat, lon, 9)
            enriched.append({
                "event_id": r["event_id"],
                "title": r["title"],
                "url": r["url"],
                "h3_r9": h3_index,
                "event_ts": r["event_ts"],
            })

    if enriched:
        try:
            CHUNK = 50000
            for i in range(0, len(enriched), CHUNK):
                client.insert_rows(Q_ENRICHED, enriched[i:i+CHUNK],
                                   durability="sync", format="json")
        except Exception as e:
            print(f"[batch {batch_id}] insert error: {e}")
            return

    _batch_count += 1

    hit = len(enriched) / max(len(rows), 1) * 100
    print(f"[batch {batch_id}] Обработано строк: in={len(rows)} enriched={len(enriched)} hit={hit:.0f}%")


def main():
    spark = SparkSession.builder.appName("wikpulse-enrich").getOrCreate()

    raw_stream = (
        spark.readStream
        .format("yt")
        .option("consumer_path", CONSUMER_PATH)
        .load(Q_RAW)
    )

    safe_stream = raw_stream.select(
        F.col("event_id").cast(T.StringType()).alias("event_id"),
        F.col("event_ts").cast(T.LongType()).alias("event_ts"),
        F.col("wiki").cast(T.StringType()).alias("wiki"),
        F.col("title").cast(T.StringType()).alias("title"),
        F.col("url").cast(T.StringType()).alias("url")
    )

    query = (
        safe_stream.writeStream
        .foreachBatch(enrich_batch)
        .trigger(processingTime="5 seconds")
        .option("checkpointLocation", CHECKPOINT_PATH)
        .start()
    )
    print(f"Стабильный Streaming запущен")
    print("-" * 60)

    query.awaitTermination()


if __name__ == "__main__":
    main()
