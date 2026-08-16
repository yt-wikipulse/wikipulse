# WikiPulse BigData

Управление таблицами YTsaurus, ингестор, SPYT-jobs, агрегация витрин.

## Структура

```
bigdata/
├── requirements.txt          ← зависимости (версии из гайда хакатона)
├── config/
│   └── hackathon.yaml        ← пути к таблицам team12
├── scripts/                  ← одноразовые скрипты (CLI)
│   ├── init_tables.py        ← создать все таблицы на кластере
│   └── load_dict_coords.py   ← загрузить справочник координат
├── jobs/                     ← постоянно/периодически работающие
│   ├── ingestor.py           ← SSE → Q_RAW (работает на твоём ноуте)
│   ├── spyt_enrich.py        ← Q_RAW → JOIN → Q_ENRICHED (на кластере)
│   ├── archiver.py           ← Q_ENRICHED → T_HISTORY, раз в час (на ноуте)
│   └── spyt_marts.py         ← T_HISTORY → витрины дашборда (на кластере)
└── README.md                 ← этот файл
```

## Быстрый старт

### 0. Один раз на машину (установка окружения)

```bash
# Python 3.12
python3.12 -V || brew install python@3.12

# Виртуальное окружение
python3.12 -m venv ~/spyt-summer-school
source ~/spyt-summer-school/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# DNS для кластера (без этого ничего не работает!)
echo "203.0.113.10 rpc-proxy.example.com" \
  | sudo tee -a /etc/hosts

# Файл входа (создай вручную, вставь свой токен)
cat > ~/a-summer-school << 'EOF'
source ~/spyt-summer-school/bin/activate
export YT_PROXY=https://your-cluster.example.com/
export YT_TOKEN=ТВОЙ_ТОКЕН_СЮДА
source spyt-env
EOF
```

### 1. Перед каждой сессией работы

```bash
source ~/a-summer-school
yt whoami              # проверка доступа
```

### 2. Создать таблицы (один раз)

```bash
python scripts/init_tables.py
```

Проверка:
```bash
yt list //home/wikipulse
```

### 3. Загрузить справочник координат

```bash
# Быстрый вариант — 100 тестовых элементов из Wikidata API
python scripts/load_dict_coords.py --sample

# Проверка
yt select-rows "* from [//home/wikipulse/dict/coords] limit 10"
```

### 4. Запустить ингестор (SSE → Q_RAW)

Это **не** spark-джоба. Обычный Python, работает на твоём ноуте.

```bash
python jobs/ingestor.py
```

В терминале увидишь:
```
2026-08-08 ... [INFO] записано 100 | in=450 out=100 filtered=350 | last=...
```

Проверь, что очередь наполняется:
```bash
yt select-rows "* from [//home/wikipulse/q_raw] limit 5" --format json
```

### 5. Загрузить enrich-скрипт на кластер

Spark-джобы запускаются **на кластере** (`--deploy-mode cluster`), поэтому
сначала нужно загрузить скрипт в Cypress:

```bash
# Заливаем скрипт как файл
yt write //home/wikipulse/src --file-from src/bigdata/jobs/spyt_enrich.py
```

### 6. Запустить SPYT-enrich (Q_RAW → Q_ENRICHED)

```bash
spark-submit \
  --master ytsaurus://https://your-cluster.example.com \
  --deploy-mode cluster \
  --num-executors 2 \
  --conf spark.pyspark.python=/usr/bin/python3.11 \
  --py-files yt:///home/wikipulse/lib/spyt_deps.zip \
  yt:///home/wikipulse/src/spyt_enrich.py
```

Эта джоба работает **постоянно** (24/7), пока не остановишь.
В логе появится ссылка на операцию — следи за статусом в Web UI.

Проверь результат:
```bash
yt select-rows "* from [//home/wikipulse/q_enriched] \
  where has_geo = true limit 10" --format json
```

### 7. Запустить архиватор (Q_ENRICHED → T_HISTORY)

Копирует новые строки очереди в статическую историю — источник витрин.
Курсор хранится в атрибуте `history/t_history/@archiver_last_row_index`,
поэтому перезапуск ничего не теряет и не дублирует.
```bash
uv run archiver
```

Обычно запускается по крону раз в час:
```cron
0 * * * * cd /path/to/WikiPulse/bigdata && uv run archiver >> /tmp/wikipulse_archiver.log 2>&1
```

Проверка:
```bash
yt select-rows "* from [//home/wikipulse/history/t_history] limit 5" --format json
```

⚠️ Очередь `q_enriched` живёт ограниченное время: если строки вычищаются
быстрее, чем раз в час, — запускай архиватор чаще.

### 8. Запустить агрегатор витрин (T_HISTORY → marts/*)

Загрузить скрипт:
```bash
yt write //home/wikipulse/src --file-from src/bigdata/jobs/spyt_marts.py
```

Запустить агрегацию за последние 24 часа:
```bash
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
```

⚠️ `spark.shuffle.useOldFetchProtocol=true` — обязательный костыль для кластера:
sandbox'и executor'ов на одном узле не видят /tmp друг друга, host-local
чтение шафлов падает с `NoSuchFileException .../blockmgr-*/shuffle_*`.
Старый протокол фетча отключает host-local чтение полностью.
Альтернатива: `--num-executors 1` (без соседа на узле механизм не запускается).

Параметры: `--hours` (окно, по умолчанию 24), `--top-n` (размер топов,
по умолчанию 100), `--h3-res` (резолюция H3 топа мест, по умолчанию 4).
Запуск идемпотентен: витрины перезаписываются по ключам, повторный запуск
безопасен.

Проверь витрины:
```bash
# Топ статей
yt select-rows "* from [//home/wikipulse/marts/top_articles] \
  where period = \"24h\" order by rank limit 10" --format json

# Топ гео-мест
yt select-rows "* from [//home/wikipulse/marts/top_geo] \
  where period = \"24h\" order by rank limit 10" --format json

# Тренды по часам
yt select-rows "* from [//home/wikipulse/marts/trends] \
  order by bucket_ts desc limit 24" --format json
```

## Частые проблемы

**`Unable to locate a Java Runtime`** — нет Java 17. См. гайд, пункт 3.

**`Master must either be yarn or start with spark, k8s, or local`** —
не выполнен `source ~/a-summer-school`.

**Клиент висит на подключении** — не прописан DNS в `/etc/hosts`.
См. гайд, пункт 5.

**`Unicode symbols with codes greater than 255`** — при JSON-формате
добавь опцию `encode_utf8=false` (кириллица).
