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
    {"name": "title",      "type": "string"},
    {"name": "url",        "type": "string"},
]

Q_ENRICHED_SCHEMA = [
    {"name": "$timestamp", "type": "uint64"},
    {"name": "event_id",   "type": "string"},
    {"name": "title",      "type": "string"},
    {"name": "url",        "type": "string"},
    {"name": "h3_r9",      "type": "string"},
]

DICT_COORDS_SCHEMA = [
    {"name": "wiki",  "type": "string", "sort_order": "ascending"},
    {"name": "title", "type": "string", "sort_order": "ascending"},
    {"name": "lat",   "type": "double"},
    {"name": "lon",   "type": "double"},
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
    create_dir(f"{paths.base_dir}/consumers")
    create_dir(f"{paths.base_dir}/checkpoints")

    # Очереди
    print("\n🔄 Очереди (dynamic tables):")
    create_dynamic_table(paths.q_raw,      Q_RAW_SCHEMA,      "сырые события SSE")
    create_dynamic_table(paths.q_enriched, Q_ENRICHED_SCHEMA, "обогащённые события")

    # Справочник
    print("\n📚 Справочник (static table):")
    create_static_table(paths.dict_coords, DICT_COORDS_SCHEMA, "координаты статей")

    print("\n" + "=" * 60)
    print("✅ Все таблицы готовы.")
    print(f"\nПроверь: yt list {paths.base_dir}")


if __name__ == "__main__":
    main()
