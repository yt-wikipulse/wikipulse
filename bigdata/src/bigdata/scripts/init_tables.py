#!/usr/bin/env python3
"""
    source ~/a-summer-school
    uv run init-tables
"""
import sys
import os

import yt.wrapper as yt

BASE = "//home/wikipulse"
Q_RAW      = f"{BASE}/q_raw"
Q_ENRICHED = f"{BASE}/q_enriched"
DICT_COORDS = f"{BASE}/dict/coords"
CONSUMER   = f"{BASE}/consumers/c_enrich"

T_HISTORY         = f"{BASE}/history/t_history"
MARTS_TRENDS      = f"{BASE}/marts/trends"
MARTS_TOP_ARTICLES = f"{BASE}/marts/top_articles"
MARTS_TOP_GEO     = f"{BASE}/marts/top_geo"


def check_env():
    proxy = os.environ.get("YT_PROXY")
    if not proxy:
        print("ОШИБКА: YT_PROXY не задан.")
        print("Выполни: source ~/a-summer-school")
        sys.exit(1)
    print(f"Прокси: {proxy}")
    print(f"Пользователь: {yt.get_user_name()}")
    print()


Q_RAW_SCHEMA = [
    {"name": "$timestamp", "type": "uint64"},
    {"name": "event_id",   "type": "string"},
    {"name": "wiki",       "type": "string"},
    {"name": "title",      "type": "string"},
    {"name": "url",        "type": "string"},
    {"name": "event_ts",   "type": "uint64"},
]

Q_ENRICHED_SCHEMA = [
    {"name": "event_id", "type": "string"},
    {"name": "title",    "type": "string"},
    {"name": "url",      "type": "string"},
    {"name": "h3_r9",    "type": "string"},
    {"name": "event_ts", "type": "uint64"},
]

DICT_COORDS_SCHEMA = [
    {"name": "wiki",  "type": "string", "sort_order": "ascending"},
    {"name": "title", "type": "string", "sort_order": "ascending"},
    {"name": "lat",   "type": "double"},
    {"name": "lon",   "type": "double"},
]

T_HISTORY_SCHEMA = [
    {"name": "event_id", "type": "string"},
    {"name": "title",    "type": "string"},
    {"name": "url",      "type": "string"},
    {"name": "h3_r9",    "type": "string"},
    {"name": "event_ts", "type": "uint64"},
]

MARTS_TRENDS_SCHEMA = [
    {"name": "bucket_ts",   "type": "uint64", "sort_order": "ascending"},
    {"name": "edits_count", "type": "int64"},
]

MARTS_TOP_ARTICLES_SCHEMA = [
    {"name": "period",      "type": "string", "sort_order": "ascending"},
    {"name": "rank",        "type": "int64",  "sort_order": "ascending"},
    {"name": "title",       "type": "string"},
    {"name": "url",         "type": "string"},
    {"name": "edits_count", "type": "int64"},
]

MARTS_TOP_GEO_SCHEMA = [
    {"name": "period",        "type": "string", "sort_order": "ascending"},
    {"name": "rank",          "type": "int64",  "sort_order": "ascending"},
    {"name": "h3_parent",     "type": "string"},
    {"name": "top_title",     "type": "string"},
    {"name": "top_url",       "type": "string"},
    {"name": "edits_count",   "type": "int64"},
    {"name": "articles_count", "type": "int64"},
]


def create_dir(path):
    yt.create("map_node", path, recursive=True, ignore_existing=True)
    print(f"  📁 {path}")


def create_static_table(path, schema, description):
    if yt.exists(path):
        print(f"  ✓ {path} (уже существует) — {description}")
        return
    yt.create("table", path, attributes={"schema": schema}, recursive=True)
    print(f"  ✚ {path} — {description}")


def create_dynamic_table(path, schema, description):
    if yt.exists(path):
        mounted = yt.get(f"{path}/@tablet_count") > 0
        if mounted:
            print(f"  ✓ {path} (существует, смонтирована) — {description}")
        else:
            print(f"  ⚠️  {path} (существует, НЕ смонтирована) — монтирую...")
            yt.mount_table(path, sync=True)
            print(f"  ✓ {path} смонтирована — {description}")
        return
    yt.create("table", path, attributes={"dynamic": True, "schema": schema}, recursive=True)
    yt.mount_table(path, sync=True)
    print(f"  ✚ {path} (создана + смонтирована) — {description}")


def create_consumer(consumer_path, queue_path, description):
    if yt.exists(consumer_path):
        registered = any(
            reg.get("consumer_path", "").endswith(consumer_path.split("/")[-1])
            for reg in yt.list_queue_consumer_registrations(queue_path=queue_path)
        )
        if registered:
            print(f"  ✓ {consumer_path} (существует, зарегистрирован) — {description}")
            return
        print(f"  ⚠️  {consumer_path} (существует, НЕ зарегистрирован) — регистрирую...")
    else:
        yt.create("queue_consumer", consumer_path, recursive=True)
        yt.mount_table(consumer_path, sync=True)
        print(f"  ✚ {consumer_path} (создан) — {description}")
    yt.register_queue_consumer(queue_path, consumer_path, vital=True)
    print(f"  🔗 {consumer_path} → {queue_path} (vital)")


def main():
    check_env()
    print(f"Создание таблиц в {BASE}")
    print("=" * 60)

    print("\n📂 Папки:")
    create_dir(BASE)
    create_dir(f"{BASE}/dict")
    create_dir(f"{BASE}/consumers")
    create_dir(f"{BASE}/checkpoints")
    create_dir(f"{BASE}/history")
    create_dir(f"{BASE}/marts")

    print("\n🔄 Очереди (dynamic tables):")
    create_dynamic_table(Q_RAW,      Q_RAW_SCHEMA,      "сырые события SSE")
    create_dynamic_table(Q_ENRICHED, Q_ENRICHED_SCHEMA, "обогащённые события")

    print("\n📬 Consumer:")
    create_consumer(CONSUMER, Q_RAW, "consumer для enrich-стрима")

    print("\n📚 Справочник (static table):")
    create_static_table(DICT_COORDS, DICT_COORDS_SCHEMA, "координаты статей")

    print("\n🗄 История (static table):")
    create_static_table(T_HISTORY, T_HISTORY_SCHEMA, "архив q_enriched, источник витрин")

    print("\n📊 Витрины дашборда (dynamic tables):")
    create_dynamic_table(MARTS_TRENDS, MARTS_TRENDS_SCHEMA, "правки по часам")
    create_dynamic_table(MARTS_TOP_ARTICLES, MARTS_TOP_ARTICLES_SCHEMA, "топ правимых статей (снапшот)")
    create_dynamic_table(MARTS_TOP_GEO, MARTS_TOP_GEO_SCHEMA, "топ гео-мест (снапшот)")

    print("\n" + "=" * 60)
    print("✅ Все таблицы готовы.")


if __name__ == "__main__":
    main()
