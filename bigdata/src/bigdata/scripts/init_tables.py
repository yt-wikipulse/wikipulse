#!/usr/bin/env python3
import yt.wrapper as yt

from bigdata import paths
from bigdata.runtime import proxy_url, require_env

AUTO_TRIM_CONFIG = {"enable": True}

Q_RAW_SCHEMA = [
    {"name": "$timestamp", "type": "uint64"},
    {"name": "event_id",   "type": "string"},
    {"name": "wiki",       "type": "string"},
    {"name": "title",      "type": "string"},
    {"name": "url",        "type": "string"},
    {"name": "event_ts",   "type": "uint64"},
    {"name": "length_update", "type": "int64"},
    {"name": "diff_url", "type": "string"},
]

Q_ENRICHED_SCHEMA = [
    {"name": "event_id", "type": "string"},
    {"name": "title",    "type": "string"},
    {"name": "url",      "type": "string"},
    {"name": "h3_r9",    "type": "string"},
    {"name": "event_ts", "type": "uint64"},
    {"name": "length_update", "type": "int64"},
    {"name": "diff_url", "type": "string"},
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
    {"name": "length_update", "type": "int64"},
    {"name": "diff_url", "type": "string"},
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


def check_env():
    require_env("YT_PROXY", "YT_TOKEN")
    print(f"Прокси: {proxy_url()}")
    print(f"Пользователь: {yt.get_user_name()}")
    print()


def create_dir(path):
    yt.create("map_node", path, recursive=True, ignore_existing=True)
    print(f"  каталог {path}")


def create_static_table(path, schema, description):
    if yt.exists(path):
        print(f"  есть {path} — {description}")
        return
    yt.create("table", path, attributes={"schema": schema}, recursive=True)
    print(f"  создана {path} — {description}")


def create_dynamic_table(path, schema, description):
    if not yt.exists(path):
        yt.create("table", path, attributes={"dynamic": True, "schema": schema},
                  recursive=True)
        yt.mount_table(path, sync=True)
        print(f"  создана и смонтирована {path} — {description}")
        return
    state = yt.get(f"{path}/@tablet_state")
    if state == "mounted":
        print(f"  есть, смонтирована {path} — {description}")
        return
    print(f"  есть, состояние {state} — монтирую {path}")
    yt.mount_table(path, sync=True)


def enable_auto_trim(path):
    yt.set(f"{path}/@auto_trim_config", AUTO_TRIM_CONFIG)
    print(f"  auto_trim включён на {path}")


def create_consumer(consumer_path, queue_path, description):
    if yt.exists(consumer_path):
        registered = any(
            str(reg.get("consumer_path", "")) == consumer_path
            for reg in yt.list_queue_consumer_registrations(queue_path=queue_path)
        )
        if registered:
            print(f"  есть, зарегистрирован {consumer_path} — {description}")
            return
        print(f"  есть, НЕ зарегистрирован {consumer_path} — регистрирую")
    else:
        yt.create("queue_consumer", consumer_path, recursive=True)
        yt.mount_table(consumer_path, sync=True)
        print(f"  создан {consumer_path} — {description}")
    yt.register_queue_consumer(queue_path, consumer_path, vital=True)
    print(f"  {consumer_path} -> {queue_path} (vital)")


def main():
    check_env()
    print(f"Создание таблиц в {paths.BASE}")
    print("=" * 60)

    print("\nКаталоги:")
    for path in (paths.BASE, paths.DICT_DIR, paths.CONSUMERS_DIR,
                 paths.CHECKPOINTS_DIR, paths.HISTORY_DIR, paths.MARTS_DIR,
                 paths.LIB_DIR, paths.SRC_DIR):
        create_dir(path)

    print("\nОчереди (dynamic tables):")
    create_dynamic_table(paths.Q_RAW, Q_RAW_SCHEMA, "сырые события SSE")
    create_dynamic_table(paths.Q_ENRICHED, Q_ENRICHED_SCHEMA, "обогащённые события")

    print("\nConsumers:")
    create_consumer(paths.CONSUMER_ENRICH, paths.Q_RAW, "consumer для enrich-стрима")
    create_consumer(paths.CONSUMER_ARCHIVE, paths.Q_ENRICHED, "consumer архиватора")

    print("\nАвтотрим очередей:")
    enable_auto_trim(paths.Q_RAW)
    enable_auto_trim(paths.Q_ENRICHED)

    print("\nСправочник (static table):")
    create_static_table(paths.DICT_COORDS, DICT_COORDS_SCHEMA, "координаты статей")

    print("\nИстория (static table):")
    create_static_table(paths.T_HISTORY, T_HISTORY_SCHEMA,
                        "архив q_enriched, источник витрин")

    print("\nВитрины дашборда (dynamic tables):")
    create_dynamic_table(paths.MARTS_TRENDS, MARTS_TRENDS_SCHEMA, "правки по часам")
    create_dynamic_table(paths.MARTS_TOP_ARTICLES, MARTS_TOP_ARTICLES_SCHEMA,
                         "топ правимых статей (снапшот)")
    create_dynamic_table(paths.MARTS_TOP_GEO, MARTS_TOP_GEO_SCHEMA,
                         "топ гео-мест (снапшот)")

    print("\n" + "=" * 60)
    print("Все таблицы готовы.")


if __name__ == "__main__":
    main()
