#!/usr/bin/env python3
"""
    yt write-file //home/wikipulse/src/spyt_marts.py < src/bigdata/jobs/spyt_marts.py

    spark-submit \
      --master ytsaurus://https://your-cluster.example.com \
      --deploy-mode cluster \
      --num-executors 2 --executor-memory 2g --executor-cores 1 \
      --driver-memory 2g \
      --conf spark.hadoop.yt.proxy.role=http \
      --conf spark.yarn.appMasterEnv.YT_TOKEN=$YT_TOKEN \
      --conf spark.yarn.appMasterEnv.YT_PROXY=your-cluster.example.com \
      --conf spark.pyspark.python=/usr/bin/python3.11 \
      --conf spark.shuffle.useOldFetchProtocol=true \
      --py-files yt:///home/wikipulse/lib/spyt_deps.zip \
      --files yt:///home/wikipulse/lib/h3.zip \
      yt:///home/wikipulse/src/spyt_marts.py --hours 24
"""
import argparse
import os
import sys
import time
import zipfile

try:
    import h3
except ImportError:

    if not os.path.exists("/tmp/h3_extracted"):
        if os.path.exists("h3.zip"):
            with zipfile.ZipFile("h3.zip", "r") as zip_ref:
                zip_ref.extractall("/tmp/h3_extracted")
    sys.path.insert(0, "/tmp/h3_extracted")
    import h3

import yt.wrapper as yt

BASE = "//home/wikipulse"
T_HISTORY          = f"{BASE}/history/t_history"
MARTS_TRENDS       = f"{BASE}/marts/trends"
MARTS_TOP_ARTICLES = f"{BASE}/marts/top_articles"
MARTS_TOP_GEO      = f"{BASE}/marts/top_geo"
PROXY = "https://your-cluster.example.com/"

INSERT_CHUNK = 50000

_yt_client = None

def get_yt_client():
    global _yt_client
    if _yt_client is None:
        token = os.environ.get("YT_TOKEN") or os.environ.get("YT_SECURE_VAULT_YT_TOKEN") or ""
        current_proxy = os.environ.get("YT_PROXY") or PROXY
        if not current_proxy.startswith("http"):
            current_proxy = f"https://{current_proxy}"
        _yt_client = yt.YtClient(proxy=current_proxy, token=token)
    return _yt_client


def with_ranks(rows: list[dict], top_n: int, period: str) -> list[dict]:
    def sort_key(r):
        return (-r["edits_count"], r.get("title") or r.get("top_title") or "")

    ordered = sorted(rows, key=sort_key)[:top_n]
    return [dict(r, period=period, rank=i + 1) for i, r in enumerate(ordered)]


def insert_chunks(client, table: str, rows: list[dict]):
    for i in range(0, len(rows), INSERT_CHUNK):
        client.insert_rows(table, rows[i:i + INSERT_CHUNK],
                           update=True, durability="sync", format="json")


def mark_computed(client, table: str, window_hours: int, **extra):
    client.set(f"{table}/@computed_at", int(time.time()))
    client.set(f"{table}/@window_hours", window_hours)
    for key, value in extra.items():
        client.set(f"{table}/@{key}", value)


def compute_trends(df, period: str) -> list[dict]:
    from pyspark.sql import functions as F

    agg = (
        df.groupBy((F.col("event_ts") - F.col("event_ts") % 3600).alias("bucket_ts"))
        .agg(F.count(F.lit(1)).alias("edits_count"))
        .collect()
    )
    return [
        {"bucket_ts": int(r["bucket_ts"]), "edits_count": int(r["edits_count"])}
        for r in agg
    ]


def compute_top_articles(df, top_n: int, period: str) -> list[dict]:
    from pyspark.sql import functions as F

    agg = (
        df.groupBy("title", "url")
        .agg(F.count(F.lit(1)).alias("edits_count"))
        .orderBy(F.desc("edits_count"), F.asc("title"))
        .limit(top_n)
        .collect()
    )
    rows = [
        {"title": r["title"], "url": r["url"], "edits_count": int(r["edits_count"])}
        for r in agg
    ]
    return with_ranks(rows, top_n, period)


def compute_top_geo(df, spark, top_n: int, h3_res: int, period: str) -> list[dict]:
    from pyspark.sql import functions as F

    distinct_cells = [r["h3_r9"] for r in df.select("h3_r9").distinct().collect()]
    print(f"Уникальных h3_r9 в окне: {len(distinct_cells)}")
    parent_pairs = [(c, h3.cell_to_parent(c, h3_res)) for c in distinct_cells]
    parent_df = spark.createDataFrame(parent_pairs, ["h3_r9", "h3_parent"])

    per_article = (
        df.join(parent_df, "h3_r9")
        .groupBy("h3_parent", "title", "url")
        .agg(F.count(F.lit(1)).alias("edits_count"))
    )
    top = (
        per_article.groupBy("h3_parent")
        .agg(
            F.sum("edits_count").alias("edits_count"),
            F.count(F.lit(1)).alias("articles_count"),
            F.max_by("title", "edits_count").alias("top_title"),
            F.max_by("url", "edits_count").alias("top_url"),
        )
        .orderBy(F.desc("edits_count"), F.asc("h3_parent"))
        .limit(top_n)
        .collect()
    )
    rows = [
        {
            "h3_parent": r["h3_parent"],
            "top_title": r["top_title"],
            "top_url": r["top_url"],
            "edits_count": int(r["edits_count"]),
            "articles_count": int(r["articles_count"]),
        }
        for r in top
    ]
    return with_ranks(rows, top_n, period)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Расчёт витрин дашборда из history/t_history"
    )
    parser.add_argument("--hours", type=int, default=24,
                        help="окно агрегации, часов (по умолчанию 24)")
    parser.add_argument("--top-n", type=int, default=100,
                        help="размер топов (по умолчанию 100)")
    parser.add_argument("--h3-res", type=int, default=6,
                        help="резолюция H3 для топа гео-мест (по умолчанию 6)")
    return parser.parse_args()


def main():
    from pyspark.sql import SparkSession
    from pyspark.sql import functions as F
    from pyspark.sql import types as T

    args = parse_args()
    period = f"{args.hours}h"

    spark = SparkSession.builder.appName("wikipulse-marts").getOrCreate()
    client = get_yt_client()

    now = int(time.time())
    window_start = now - args.hours * 3600

    print(f"Читаю {T_HISTORY} за {args.hours} ч (event_ts >= {window_start})")
    print("-" * 60)

    history = (
        spark.read
        .format("yt")
        .load(T_HISTORY)
        .select(
            F.col("event_id").cast(T.StringType()).alias("event_id"),
            F.col("title").cast(T.StringType()).alias("title"),
            F.col("url").cast(T.StringType()).alias("url"),
            F.col("h3_r9").cast(T.StringType()).alias("h3_r9"),
            F.col("event_ts").cast(T.LongType()).alias("event_ts"),
        )
        .where(F.col("event_ts") >= window_start)
        .dropDuplicates(["event_id"])
    )
    total = history.count()
    print(f"Событий в окне (после дедупа по event_id): {total}")
    if total == 0:
        print("Окно пустое — витрины не трогаю. Запусти archiver или расширь --hours.")
        spark.stop()
        return

    trend_rows = compute_trends(history, period)
    insert_chunks(client, MARTS_TRENDS, trend_rows)
    mark_computed(client, MARTS_TRENDS, args.hours)
    print(f"marts/trends: {len(trend_rows)} часовых бакетов")

    article_rows = compute_top_articles(history, args.top_n, period)
    insert_chunks(client, MARTS_TOP_ARTICLES, article_rows)
    mark_computed(client, MARTS_TOP_ARTICLES, args.hours, top_n=args.top_n)
    print(f"marts/top_articles: {len(article_rows)} статей")

    geo_rows = compute_top_geo(history, spark, args.top_n, args.h3_res, period)
    insert_chunks(client, MARTS_TOP_GEO, geo_rows)
    mark_computed(client, MARTS_TOP_GEO, args.hours, top_n=args.top_n, h3_res=args.h3_res)
    print(f"marts/top_geo: {len(geo_rows)} мест (h3 res {args.h3_res})")

    print("=" * 60)
    print("Витрины обновлены.")
    spark.stop()


if __name__ == "__main__":
    main()
