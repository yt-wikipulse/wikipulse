# WikiPulse BigData

Пайплайн поверх YTsaurus: поток правок Википедии → очередь → обогащение
координатами и H3 → история → витрины дашборда.

```text
SSE recentchange
      │  ingestor            обычный python, вне кластера
      ▼
   q_raw ──────────── consumer c_enrich
      │  spyt_enrich         SPYT structured streaming, на кластере
      ▼
 q_enriched ──────── consumer c_archive
      │  archiver            обычный python, курсор в атрибуте таблицы
      ▼
history/t_history
      │  spyt_marts          SPYT batch, на кластере
      ▼
marts/{trends,top_articles,top_geo}
```

Шедулер (`scheduler`) гоняет `archiver` + `spyt_marts` по расписанию. Бэкенд
в этой схеме читает `q_enriched` (живая карта) и `marts/*` (дашборд) сам,
эта часть — в корневом [README](../README.md).

## Структура

```text
bigdata/
├── pyproject.toml                   ← зависимости и entry points
├── implementation-notes.md          ← почему сделано именно так
├── src/bigdata/
│   ├── paths.py                     ← все пути в Cypress, единственный источник
│   ├── runtime.py                   ← окружение: прокси, токен, User-Agent, h3
│   ├── scripts/
│   │   ├── init_tables.py           ← создать таблицы, очереди, консьюмеров
│   │   ├── load_dict_coords_full.py ← справочник координат из дампа Wikidata
│   │   └── upload_artifacts.py      ← собрать и залить артефакты SPYT
│   └── jobs/
│       ├── ingestor.py              ← SSE → q_raw
│       ├── spyt_enrich.py           ← q_raw → q_enriched (на кластере)
│       ├── archiver.py              ← q_enriched → t_history
│       ├── spyt_marts.py            ← t_history → витрины (на кластере)
│       └── scheduler.py             ← archiver + spyt_marts по расписанию
└── tests/
    ├── test_paths.py
    ├── test_runtime.py
    ├── test_scheduler.py
    ├── test_spyt_marts.py
    └── test_upload_artifacts.py
```

Ни один путь в Cypress не зашит в модули: всё строится в `paths.py` от
`YT_BASE_PATH`. Меняешь корень — меняешь одну переменную.

## Установка

```bash
python3.12 -m venv .venv
. .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e .              # клиент YTsaurus, ингестор, архиватор, шедулер
pip install -e ".[spark]"     # плюс локальный pyspark, если он нужен вне кластера
```

`pip install -e .` ставит и CLI `yt` — он приходит с `ytsaurus-client`, отдельно
его ставить не нужно. Все команды проверки ниже — это он.

`spark-submit` берётся из окружения SPYT, а не из этого пакета: на кластере
драйвер запускается своим питоном (`spark.pyspark.python`), а локальный
`pyspark` нужен только для отладки. Как поставить SPYT —
[`setup/spyt-env.md`](../setup/spyt-env.md).

## Entry points

Всё, что можно запустить, объявлено в `[project.scripts]` и после
`pip install -e .` доступно по имени:

| Команда | Модуль | Что делает |
|---|---|---|
| `init-tables` | `scripts/init_tables.py` | создаёт каталоги, очереди, консьюмеров, историю и витрины |
| `upload-artifacts` | `scripts/upload_artifacts.py` | собирает и заливает `bigdata.zip`, `h3.zip` и скрипты джоб |
| `load-dict-coords-full` | `scripts/load_dict_coords_full.py` | наполняет справочник координат из дампа Wikidata |
| `ingestor` | `jobs/ingestor.py` | читает SSE Wikimedia и пишет в `q_raw` |
| `archiver` | `jobs/archiver.py` | переливает `q_enriched` в `history/t_history` |
| `scheduler` | `jobs/scheduler.py` | `archiver` + `spyt_marts` по расписанию |

`spyt_enrich.py` и `spyt_marts.py` в этой таблице нет намеренно: они не
запускаются локально, их запускает `spark-submit` на кластере из
`{base}/src/`, куда их кладёт `upload-artifacts`.

## Переменные окружения

| Переменная | Обязательна | По умолчанию | Зачем |
|---|---|---|---|
| `YT_PROXY` | да | — | адрес HTTP-прокси кластера, со схемой или без |
| `YT_TOKEN` | да | — | токен YTsaurus |
| `YT_BASE_PATH` | нет | `//home/wikipulse` | корень всех таблиц проекта |
| `WIKIPULSE_CONTACT` | нет | `https://github.com/yt-wikipulse/wikipulse` | контакт в `User-Agent` запросов к Wikimedia |

`WIKIPULSE_CONTACT` — не косметика: Wikimedia требует в `User-Agent` рабочий
способ связи, и это условие их User-Agent policy, а не пожелание.

В примерах ниже `YT_PROXY` подставляется в `--master` целиком, поэтому задавай
его со схемой: `export YT_PROXY=https://<proxy-host>`. В путях Cypress
используется `yt:/$YT_BASE_PATH/...`: одиночный слэш после `yt:` плюс путь,
начинающийся с `//`, даёт ровно `yt:///...`, как ждёт SPYT.

Токен нигде не передаётся аргументом командной строки: ни в спеку YT-операции,
ни в Spark UI он не попадает. Джобы на кластере читают его из
`YT_SECURE_VAULT_YT_TOKEN`, который YTsaurus кладёт в окружение операции сам.

## Порядок запуска

Шаги 1–3 выполняются один раз на кластер, 4–8 — это то, что работает
постоянно. `deploy/compose.yml` поднимает в контейнерах шаги 4 и 8; шаги
1–3 всё равно делаются руками, до первого запуска compose.

### 1. Таблицы

```bash
init-tables
yt list $YT_BASE_PATH
```

Идемпотентно: существующие таблицы не пересоздаются, размонтированные
монтируются, консьюмеры при необходимости регистрируются заново. Обеим
очередям включается `auto_trim_config`, и на `q_enriched` регистрируется
vital-консьюмер `c_archive` — без него автотрим срезал бы очередь сразу,
не дожидаясь архиватора.

### 2. Артефакты для SPYT

```bash
upload-artifacts             # bigdata.zip + h3.zip + скрипты джоб
upload-artifacts --skip-h3   # если h3.zip уже лежит в {base}/lib
```

Собирает и кладёт в Cypress:

- `{base}/lib/bigdata.zip` — сам пакет, чтобы джобы на кластере видели
  `bigdata.paths` (уходит в `--py-files`);
- `{base}/lib/h3.zip` — колесо `h3` под питон кластера (уходит в `--files`,
  джоба распаковывает его сама);
- `{base}/src/spyt_enrich.py`, `{base}/src/spyt_marts.py` — сами джобы.

**Без этого шага любая SPYT-джоба падает с `ModuleNotFoundError: bigdata`.**
Он обязателен и на чистом кластере, и после любой правки джоб или `paths.py`.

`h3.zip` в git не хранится — он собирается здесь и каждый раз заново:

```
pip install h3 --target <tmp> \
  --platform manylinux2014_x86_64 --python-version 3.11 --only-binary=:all:
```

`h3` — расширение на C, и колесо должно совпасть с питоном и архитектурой
узлов кластера. Константы `CLUSTER_PYTHON` и `CLUSTER_PLATFORM` в
`src/bigdata/scripts/upload_artifacts.py` задают именно это и должны совпадать
со `spark.pyspark.python` в командах запуска ниже. Другой образ кластера —
правь обе константы вместе.

### 3. Справочник координат

```bash
load-dict-coords-full --max-rows 10000   # проверочный прогон
load-dict-coords-full                    # весь дамп Wikidata, долго

yt get $YT_BASE_PATH/dict/coords/@row_count
yt read-table "$YT_BASE_PATH/dict/coords[:#10]" --format '<encode_utf8=false>json'
```

Проверка здесь через `read-table`, а не `select-rows`, потому что загрузчик
оставляет `dict/coords` **статической** отсортированной таблицей, а
`select-rows` и `lookup_rows` работают только со смонтированной динамической.
Перед шагом 5 таблицу нужно перевести в динамическую вручную; почему это не
зашито в скрипт — в [`implementation-notes.md`](implementation-notes.md),
раздел `paths.py / DICT_COORDS`.

### 4. Ингестор

```bash
ingestor
yt select-rows "* from [$YT_BASE_PATH/q_raw] limit 5" --format '<encode_utf8=false>json'
```

Работает 24/7. В заголовках запросов уходит `WIKIPULSE_CONTACT` — задай его,
если гоняешь ингестор долго.

### 5. Обогащение (постоянная джоба на кластере)

```bash
spark-submit \
  --master ytsaurus://$YT_PROXY \
  --deploy-mode cluster \
  --num-executors 1 --executor-memory 1g --executor-cores 1 \
  --driver-memory 2g \
  --conf spark.hadoop.yt.proxy.role=http \
  --conf spark.yarn.appMasterEnv.YT_PROXY=$YT_PROXY \
  --conf spark.yarn.appMasterEnv.YT_BASE_PATH=$YT_BASE_PATH \
  --conf spark.pyspark.python=/usr/bin/python3.11 \
  --py-files yt:///home/wikipulse/lib/spyt_deps.zip,yt:/$YT_BASE_PATH/lib/bigdata.zip \
  --files yt:/$YT_BASE_PATH/lib/h3.zip \
  yt:/$YT_BASE_PATH/src/spyt_enrich.py
```

`spyt_deps.zip` — общий архив зависимостей стенда, на котором писался проект,
а не часть репозитория: на своём кластере замени путь или убери его из
`--py-files` (см. «Что нужно поправить под свой кластер»). Остальные два
`yt:`-пути принадлежат проекту и берутся из `paths.py`.

Джоба читает `q_raw` через консьюмер `c_enrich` и работает 24/7, пока её не
остановить. Правки статей, которых нет в справочнике координат, она молча
отбрасывает — поэтому `q_enriched` заметно короче `q_raw`, а в логе каждого
батча есть строка `hit=NN%`. Низкий hit означает не поломку джобы, а неполный
или несмонтированный `dict/coords`.

```bash
yt select-rows "* from [$YT_BASE_PATH/q_enriched] limit 10" --format '<encode_utf8=false>json'
```

### 6. Архиватор

```bash
archiver
yt read-table "$YT_BASE_PATH/history/t_history[:#5]" --format '<encode_utf8=false>json'
yt get $YT_BASE_PATH/history/t_history/@archiver_last_row_index
```

`t_history` — статическая таблица, поэтому проверка через `read-table`.
Курсор лежит в её атрибуте `@archiver_last_row_index`, перезапуск ничего не
теряет и не дублирует. Обычно архиватор гоняет шедулер (шаг 8) — руками он
нужен только для разового прогона.

### 7. Витрины (разовый расчёт)

```bash
spark-submit \
  --master ytsaurus://$YT_PROXY \
  --deploy-mode cluster \
  --num-executors 2 --executor-memory 2g --executor-cores 1 \
  --driver-memory 2g \
  --conf spark.hadoop.yt.proxy.role=http \
  --conf spark.yarn.appMasterEnv.YT_PROXY=$YT_PROXY \
  --conf spark.yarn.appMasterEnv.YT_BASE_PATH=$YT_BASE_PATH \
  --conf spark.pyspark.python=/usr/bin/python3.11 \
  --conf spark.shuffle.useOldFetchProtocol=true \
  --py-files yt:///home/wikipulse/lib/spyt_deps.zip,yt:/$YT_BASE_PATH/lib/bigdata.zip \
  --files yt:/$YT_BASE_PATH/lib/h3.zip \
  yt:/$YT_BASE_PATH/src/spyt_marts.py --hours 24
```

Параметры: `--hours` (окно, 24), `--top-n` (размер топов, 100), `--h3-res`
(резолюция H3 для топа мест, 6). Запуск идемпотентен: витрины
перезаписываются по ключам.

Витрины — динамические таблицы, их видно через `select-rows`:

```bash
yt select-rows "* from [$YT_BASE_PATH/marts/top_articles] where period = \"24h\" order by rank limit 10" --format '<encode_utf8=false>json'
yt select-rows "* from [$YT_BASE_PATH/marts/top_geo]      where period = \"24h\" order by rank limit 10" --format '<encode_utf8=false>json'
yt select-rows "* from [$YT_BASE_PATH/marts/trends] order by bucket_ts desc limit 24" --format json
```

### 8. Шедулер

```bash
scheduler            # демон
scheduler --once     # один цикл для проверки
```

Каждый цикл (5 минут): заливает актуальный `spyt_marts.py`, запускает
`archiver`, пересчитывает витрину за 24 часа. Раз в час дополнительно —
окна 168ч и 720ч. Параметры: `--interval`, `--slow-interval`, `--top-n`,
`--h3-res`.

Пока шедулер работает, не запускай `archiver` руками: два архиватора гоняются
за одним курсором и плодят дубли в `t_history`. В `deploy/compose.yml`
отдельного архиватора по этой же причине нет — там только `ingestor` и
`scheduler`.

## Тесты

```bash
pip install pytest
pytest
```

`pip install -e .` для тестов не нужен — `pythonpath = ["src"]` в
`pyproject.toml` даёт `pytest` найти пакет без установки. Зависимости из
`[project]` при этом нужны: модули импортируют `yt.wrapper` и `h3` на верхнем
уровне, так что либо шаг «Установка» уже сделан, либо ставь их отдельно.

Тесты не ходят ни в кластер, ни в Spark — только чистые функции: вычисление
путей (`test_paths`), нормализация прокси, фолбэк токена на secure vault и
`User-Agent` (`test_runtime`), сборка командной строки `spark-submit` — в том
числе проверка, что токен в неё не попадает (`test_scheduler`), ранжирование
витрин (`test_spyt_marts`), импорт пакета из собранного `bigdata.zip`
(`test_upload_artifacts`).
Прогон занимает пару секунд.

## Что нужно поправить под свой кластер

- `SPYT_DEPS_ZIP` в `src/bigdata/jobs/scheduler.py` и `--py-files` в командах
  выше указывают на `//home/wikipulse/lib/spyt_deps.zip` — это общий архив
  зависимостей конкретного стенда, на котором писался проект. На своём
  кластере замени путь или убери его из `--py-files`.
- `spark.pyspark.python=/usr/bin/python3.11` — питон воркеров конкретного
  образа. Он же задаёт `CLUSTER_PYTHON` для сборки `h3.zip`.
- `spark.shuffle.useOldFetchProtocol=true` — обход конкретной проблемы
  с шафлами, см. [`implementation-notes.md`](implementation-notes.md).
- Перевод `dict/coords` в динамическую таблицу — шаг 3, тоже не универсальный:
  он требует `unique_keys` и уникальности пар `(wiki, title)` на твоём дампе.

## Частые проблемы

**`Unable to locate a Java Runtime`** — для `spark-submit` нужна Java 17.

**`Master must either be yarn or start with spark, k8s, or local`** —
не подгружено окружение SPYT (`spark-env`), `spark-submit` не тот.

**`ModuleNotFoundError: bigdata`** в логе операции — не выполнен
`upload-artifacts` (шаг 2), либо `bigdata.zip` не попал в `--py-files`.

**`NoSuchFileException .../blockmgr-*/shuffle_*`** — нужен
`spark.shuffle.useOldFetchProtocol=true` либо `--num-executors 1`.

**`Unicode symbols with codes greater than 255`** — при JSON-формате в `yt`
нужен `--format '<encode_utf8=false>json'`; в командах выше он уже стоит
везде, где в выдаче бывает кириллица.

**`select-rows` не работает по `dict/coords` или `history/t_history`** — это
не поломка: обе таблицы статические, читать их надо через `read-table`.

Почему код написан именно так — в [`implementation-notes.md`](implementation-notes.md);
комментариев в коде проект не держит.
