# Пайплайн на локальном кластере YTsaurus

Путь от чистого клона до кластера YTsaurus, поднятого на своей машине.
Переменные окружения одной таблицей — в [configuration.md](configuration.md);
если кластер не нужен, есть профиль `mock` из [local-setup.md](local-setup.md).

**SPYT на локальном кластере не запускается:** обе Spark-джобы идут через
`spark-submit --master ytsaurus://…`, и на однонодовом образе этот путь не
работает. Следствие — `q_enriched` сам собой не наполняется и витрины не
считаются; проверить бэкенд поверх кластера это не мешает, см. шаг 6.

## 1. Поднять кластер

Нужен Docker и около 7 ГБ на диске под образы `ghcr.io/ytsaurus/local`
и `ghcr.io/ytsaurus/ui`.

```bash
curl -O https://raw.githubusercontent.com/ytsaurus/ytsaurus/main/yt/docker/local/run_local_cluster.sh
bash run_local_cluster.sh --rpc-proxy-count 1
```

**`--rpc-proxy-count 1` обязателен:** по умолчанию скрипт поднимает ноль
RPC-прокси, а бэкенд и `spark-submit` ходят в YTsaurus именно по RPC.
HTTP-прокси (`bigdata`, `yt` CLI) работает и без флага.

| Порт | Что |
|---|---|
| 8000 | HTTP-прокси кластера |
| 8001 | веб-интерфейс |
| 8002 | RPC-прокси |

Проверка, что кластер жив и RPC-прокси видна снаружи контейнера:

```bash
curl -s http://localhost:8000/api/v4/get?path=//sys/@cluster_name
curl -s "http://localhost:8000/api/v4/discover_proxies?type=rpc"
```

Ответы — `{"value":"locasaurus"}` и `{"proxies":["localhost:8002"]}`. Второй
важнее: клиент берёт адреса RPC-прокси у HTTP-прокси и идёт по ним, так что
адрес в ответе должен резолвиться с твоей машины (`--docker-hostname`).

Остановить: `bash run_local_cluster.sh --stop`. **Данные живут, пока живёт
контейнер** — он запускается с `--rm`, после `--stop` шаги 3–5 повторяются.
Аутентификация выключена, но `YT_TOKEN` задать всё равно нужно: его требуют
и `bigdata`, и бэкенд, а значение подойдёт любое.

## 2. Переменные окружения

```bash
export YT_PROXY=http://localhost:8000
export YT_TOKEN=dummy
export YT_BASE_PATH=//home/wikipulse
```

**Бэкенду нужен тот же адрес без схемы** — `YT_PROXY=localhost:8000`.
Java-клиент получает значение как есть, а `bigdata` дописывает `https://`,
если схемы нет, и на локальном кластере по HTTP это ломается.

## 3. Установить пакет `bigdata`

```bash
cd bigdata
python -m venv .venv && . .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -e .
```

Вместе с пакетом ставится клиент YTsaurus, а с ним CLI `yt` и команды
`init-tables`, `ingestor`, `archiver`, `upload-artifacts`, `scheduler`.

## 4. Создать таблицы

```bash
init-tables
yt list $YT_BASE_PATH
```

Проходит на минимальном кластере целиком: каталоги, обе очереди, оба
консьюмера с регистрацией `vital`, `auto_trim_config`, справочник, история и
три витрины. Queue agent `run_local_cluster.sh` поднимает сам.

## 5. Наполнить `q_raw`

```bash
ingestor
```

Читает SSE-поток `stream.wikimedia.org` и пишет отфильтрованные правки пачками
по 100 строк; за минуту приезжает пара сотен. Боты и служебные страницы
отсеиваются, поэтому `in` в логе на порядок больше `out`. Стоп по Ctrl+C.

```bash
yt select-rows "* from [$YT_BASE_PATH/q_raw] limit 5" --format '<encode_utf8=false>json'
```

## 6. Бэкенд поверх локального кластера

```bash
cd backend
SPRING_PROFILES_ACTIVE=yt YT_PROXY=localhost:8000 YT_TOKEN=dummy \
  YT_BASE_PATH=//home/wikipulse ./mvnw spring-boot:run
```

Профиль `yt` — тот же, что и в проде. Пустые таблицы не ошибка: дашборд отдаёт
корректный ответ с нулями, карта — пустой список.

Смоук-тест без SPYT — положить строку в `q_enriched` руками. Поллер на старте
перематывает очередь в конец (`skipToLatest`), так что вставлять надо уже
после запуска бэкенда:

```python
import time, h3
import yt.wrapper as yt
from bigdata import paths

yt.insert_rows(paths.Q_ENRICHED, [{
    "event_id": "ruwiki|1",
    "title": "Москва",
    "url": "https://ru.wikipedia.org/wiki/Москва",
    "h3_r9": h3.latlng_to_cell(55.75, 37.62, 9),
    "event_ts": int(time.time()),
    "length_update": 7,
    "diff_url": "https://ru.wikipedia.org/w/index.php?diff=1",
}])
```

```bash
curl -s "http://localhost:8080/api/v1/hexagons/active?min_lng=30&min_lat=50&max_lng=45&max_lat=60&zoom=10"
```

Событие появляется в ответе в течение секунды (`app.poller.interval-ms: 500`)
и живёт в кэше 30 минут.

## 7. Фронтенд

Ничем не отличается от обычного локального запуска — `pnpm dev` и
`http://localhost:5173/map`, см. [local-setup.md](local-setup.md).

## Чего на локальном кластере нет

- **Агрегатных функций в `select-rows`.** `count`, `max` и прочие ищутся как
  UDF в `//tmp/udfs`, которого в локальном образе нет: запрос падает с
  `Function "count" is not known`. Пайплайна это не касается (агрегаты считает
  Spark), но диагностику вида `max(event_ts) … group by 1` придётся заменить
  на `limit`.
- **SPYT.** См. предупреждение в начале.
- **Отказоустойчивости.** Один узел в одном контейнере; документация YTsaurus
  прямо говорит не брать эту конфигурацию для прода и для замеров.
