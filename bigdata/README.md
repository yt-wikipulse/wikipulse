# WikiPulse BigData

Пайплайн поверх YTsaurus: поток правок Википедии → очередь `q_raw` →
обогащение координатами и H3 → очередь `q_enriched` → история
`history/t_history` → витрины `marts/*`. Схема потока целиком — в корневом
[README](../README.md), устройство шагов — в
[docs/architecture/pipeline.md](../docs/architecture/pipeline.md).

Ни один путь в Cypress не зашит в модули: всё строится в `src/bigdata/paths.py`
от `YT_BASE_PATH`.

## Установка

```bash
python3.12 -m venv .venv
. .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e .              # клиент YTsaurus, ингестор, архиватор, шедулер
pip install -e ".[spark]"     # плюс локальный pyspark, если он нужен вне кластера
```

`pip install -e .` ставит и CLI `yt` — он приходит с `ytsaurus-client`. Все
команды проверки ниже — это он.

`pyspark` вынесен в extra `spark`: на кластере он приходит из образа SPYT, а
локально нужен только для отладки. Сам `spark-submit` берётся из окружения
SPYT, а не из этого пакета — как его поставить, в
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

`spyt_enrich.py` и `spyt_marts.py` в таблице нет намеренно: локально они не
запускаются, их запускает `spark-submit` на кластере из `{base}/src/`, куда их
кладёт `upload-artifacts`.

## Переменные окружения

Пакет читает `YT_PROXY`, `YT_TOKEN`, `YT_BASE_PATH` и `WIKIPULSE_CONTACT`.
Что обязательно и какие значения по умолчанию —
[docs/runbooks/configuration.md](../docs/runbooks/configuration.md).

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
очередям включается `auto_trim_config`, и на `q_enriched` регистрируются
два консьюмера: `c_archive` как vital — без него автотрим срезал бы очередь
сразу, не дожидаясь архиватора, — и `c_backend` как non-vital, чтобы
отставание живой карты триму не мешало.

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

`h3.zip` в git не хранится, он собирается здесь каждый раз заново:

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
yt select-rows "* from [$YT_BASE_PATH/dict/coords] limit 5" --format json
```

`dict/coords` — динамическая смонтированная таблица со схемой, у которой
`unique_keys = true`: обогащение читает её через `lookup_rows`, а этот API
работает только так. Загрузчик пересобирает таблицу целиком (сортировка,
дедупликация по `(wiki, title)`, конверсия в динамическую и монтирование).

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
  --py-files yt:/$YT_BASE_PATH/lib/bigdata.zip \
  --files yt:/$YT_BASE_PATH/lib/h3.zip \
  yt:/$YT_BASE_PATH/src/spyt_enrich.py
```

Оба `yt:`-пути принадлежат проекту и берутся из `paths.py`. Если на вашем
кластере зависимости SPYT лежат отдельным архивом, укажите его в переменной
`SPYT_DEPS_ZIP` — он добавится в `--py-files` первым. По умолчанию переменная
пуста и в команду ничего не добавляется.

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
yt select-rows "* from [$YT_BASE_PATH/consumers/c_archive]" --format json
```

`t_history` — статическая таблица, поэтому проверка через `read-table`.
Позиция чтения лежит в консьюмере `c_archive`, перезапуск ничего не теряет
и не дублирует. Он же vital-консьюмер очереди, поэтому автотрим `q_enriched`
идёт следом за архиватором. Обычно архиватор гоняет шедулер (шаг 8) — руками
он нужен только для разового прогона.

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
  --py-files yt:/$YT_BASE_PATH/lib/bigdata.zip \
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
pip install -e . pytest
pytest
```

Сам пакет ставить необязательно — `pythonpath = ["src"]` в `pyproject.toml`
даёт `pytest` найти его и так. А вот зависимости из `[project]` обязательны:
модули импортируют `yt.wrapper` и `h3` на верхнем уровне, и без них сбор
тестов падает на импорте. `pip install -e .` — самый короткий способ их
получить. Тесты не ходят ни в кластер, ни в Spark: только чистые функции.

## Что нужно поправить под свой кластер

- `SPYT_DEPS_ZIP` — путь к архиву зависимостей SPYT, если на вашем кластере
  они не установлены в образе воркеров. По умолчанию пусто.
- `spark.pyspark.python=/usr/bin/python3.11` — питон воркеров конкретного
  образа. Он же задаёт `CLUSTER_PYTHON` для сборки `h3.zip`.
- `spark.shuffle.useOldFetchProtocol=true` — нужен там, где sandbox'ы
  executor'ов на одном узле не видят `/tmp` друг друга и host-local чтение
  шафлов падает. Альтернатива — `--num-executors 1`.

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

**`select-rows` не работает по `history/t_history`** — это не поломка:
таблица статическая, читать её надо через `read-table`.
