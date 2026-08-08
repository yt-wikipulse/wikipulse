#!/usr/bin/env python3
"""
    source ~/a-summer-school
    uv run python -m bigdata.scripts.init_tables
"""
import sys
import os

import yt.wrapper as yt

from bigdata.config_loader import paths


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
    {"name": "lang",       "type": "string"},
    {"name": "title",      "type": "string"},
    {"name": "type",       "type": "string"},
    {"name": "user",       "type": "string"},
    {"name": "bot",        "type": "boolean"},
    {"name": "minor",      "type": "boolean"},
    {"name": "comment",    "type": "string"},
    {"name": "rev_new",    "type": "int64"},
    {"name": "rev_old",    "type": "int64"},
    {"name": "length_new", "type": "int64"},
    {"name": "length_old", "type": "int64"},
    {"name": "event_ts",   "type": "uint64"},
    {"name": "domain",     "type": "string"},
    {"name": "source_id",  "type": "string"},
]

Q_ENRICHED_SCHEMA = [
    {"name": "$timestamp", "type": "uint64"},
    {"name": "event_id",    "type": "string"},
    {"name": "wiki",        "type": "string"},
    {"name": "lang",        "type": "string"},
    {"name": "title",       "type": "string"},
    {"name": "type",        "type": "string"},
    {"name": "user",        "type": "string"},
    {"name": "bot",         "type": "boolean"},
    {"name": "minor",       "type": "boolean"},
    {"name": "comment",     "type": "string"},
    {"name": "rev_new",     "type": "int64"},
    {"name": "rev_old",     "type": "int64"},
    {"name": "length_new",  "type": "int64"},
    {"name": "length_old",  "type": "int64"},
    {"name": "event_ts",    "type": "uint64"},
    {"name": "domain",      "type": "string"},
    {"name": "has_geo",     "type": "boolean"},
    {"name": "lat",         "type": "double"},
    {"name": "lon",         "type": "double"},
    {"name": "country_qid", "type": "string"},
    {"name": "type_qid",    "type": "string"},
    {"name": "qid",         "type": "string"},
    {"name": "h3_r3",       "type": "string"},
    {"name": "h3_r6",       "type": "string"},
    {"name": "h3_r9",       "type": "string"},
    {"name": "delta_len",   "type": "int64"},
]

DICT_COORDS_SCHEMA = [
    {"name": "wiki",        "type": "string", "sort_order": "ascending"},
    {"name": "title",       "type": "string", "sort_order": "ascending"},
    {"name": "qid",         "type": "string"},
    {"name": "lat",         "type": "double"},
    {"name": "lon",         "type": "double"},
    {"name": "country_qid", "type": "string"},
    {"name": "type_qid",    "type": "string"},
    {"name": "precision",   "type": "double"},
    {"name": "source",      "type": "string"},
]

DICT_COUNTRIES_SCHEMA = [
    {"name": "qid",     "type": "string", "sort_order": "ascending"},
    {"name": "name",    "type": "string"},
    {"name": "iso",     "type": "string"},
]

T_HISTORY_SCHEMA = [
    {"name": "event_id",   "type": "string"},
    {"name": "event_ts",   "type": "uint64"},
    {"name": "wiki",       "type": "string"},
    {"name": "lang",       "type": "string"},
    {"name": "title",      "type": "string"},
    {"name": "type",       "type": "string"},
    {"name": "bot",        "type": "boolean"},
    {"name": "minor",      "type": "boolean"},
    {"name": "length_new", "type": "int64"},
    {"name": "length_old", "type": "int64"},
    {"name": "delta_len",  "type": "int64"},
    {"name": "has_geo",    "type": "boolean"},
    {"name": "lat",        "type": "double"},
    {"name": "lon",        "type": "double"},
    {"name": "country_qid","type": "string"},
    {"name": "h3_r6",      "type": "string"},
]

MART_TOP_COUNTRIES_SCHEMA = [
    {"name": "period_bucket", "type": "uint64", "sort_order": "ascending"},
    {"name": "period",        "type": "string", "sort_order": "ascending"},
    {"name": "country_qid",   "type": "string", "sort_order": "ascending"},
    {"name": "country_name",  "type": "string"},
    {"name": "edits_count",   "type": "int64"},
    {"name": "users_count",   "type": "int64"},
    {"name": "delta_total",   "type": "int64"},
]

MART_BY_LANGUAGE_SCHEMA = [
    {"name": "period_bucket", "type": "uint64", "sort_order": "ascending"},
    {"name": "period",        "type": "string", "sort_order": "ascending"},
    {"name": "lang",          "type": "string", "sort_order": "ascending"},
    {"name": "edits_count",   "type": "int64"},
    {"name": "new_articles",  "type": "int64"},
    {"name": "bots_count",   "type": "int64"},
    {"name": "humans_count",  "type": "int64"},
    {"name": "total_delta",   "type": "int64"},
]

MART_TRENDS_SCHEMA = [
    {"name": "bucket_ts",  "type": "uint64", "sort_order": "ascending"},
    {"name": "edits_count","type": "int64"},
]

def create_dir(path: str):
    try:
        yt.create("map_node", path, recursive=True, ignore_existing=True)
        print(f"  📁 {path}")
    except yt.YtError as e:
        print(f"  ⚠️  Не удалось создать папку {path}: {e}")


def create_static_table(path: str, schema: list, description: str):
    if yt.exists(path):
        print(f"  ✓ {path} (уже существует) — {description}")
        return
    yt.create("table", path, attributes={"schema": schema}, recursive=True)
    print(f"  ✚ {path} — {description}")


def create_dynamic_table(path: str, schema: list, description: str):
    if yt.exists(path):
        mounted = yt.get(f"{path}/@tablet_count") > 0
        if mounted:
            print(f"  ✓ {path} (существует, смонтирована) — {description}")
        else:
            print(f"  ⚠️  {path} (существует, НЕ смонтирована) — монтирую...")
            yt.mount_table(path, sync=True)
            print(f"  ✓ {path} смонтирована — {description}")
        return

    yt.create("table", path, attributes={
        "dynamic": True,
        "schema": schema,
    }, recursive=True)
    yt.mount_table(path, sync=True)
    print(f"  ✚ {path} (создана + смонтирована) — {description}")


def main():
    check_env()

    print(f"Создание таблиц в {paths.base_dir}")
    print("=" * 60)

    # Папки
    print("\n📂 Папки:")
    create_dir(paths.base_dir)
    create_dir(f"{paths.base_dir}/dict")
    create_dir(f"{paths.base_dir}/history")
    create_dir(f"{paths.base_dir}/marts")
    create_dir(f"{paths.base_dir}/consumers")
    create_dir(f"{paths.base_dir}/checkpoints")

    # Очереди
    print("\n🔄 Очереди (dynamic tables):")
    create_dynamic_table(paths.q_raw,      Q_RAW_SCHEMA,      "сырые события SSE")
    create_dynamic_table(paths.q_enriched, Q_ENRICHED_SCHEMA, "обогащённые события")

    # Справочники
    print("\n📚 Справочники (static tables):")
    create_static_table(paths.dict_coords,    DICT_COORDS_SCHEMA,    "координаты статей")
    create_static_table(paths.dict_countries, DICT_COUNTRIES_SCHEMA, "Q-id → название страны")

    # История
    print("\n📜 История:")
    create_static_table(paths.t_history, T_HISTORY_SCHEMA, "накопленная история enriched-событий")

    # Витрины
    print("\n📊 Витрины (dynamic tables):")
    create_dynamic_table(paths.mart_top_countries, MART_TOP_COUNTRIES_SCHEMA, "топ стран по правкам")
    create_dynamic_table(paths.mart_by_language,   MART_BY_LANGUAGE_SCHEMA,   "разрез по языкам")
    create_dynamic_table(paths.mart_trends,        MART_TRENDS_SCHEMA,        "кол-во правок по часам")

    print("\n" + "=" * 60)
    print("✅ Все таблицы готовы.")
    print(f"\nПроверь: yt list {paths.base_dir}")


if __name__ == "__main__":
    main()
