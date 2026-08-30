*[English version](README.md)*

# WikiPulse

Живая карта мира, на которой место загорается, пока правят статью Википедии
о нём, и рядом дашборд с аналитикой поверх истории этих правок. Обе половины
кормит один пайплайн, и этот пайплайн целиком живёт на **YTsaurus + SPYT**:
без Kafka, без отдельного хранилища под витрины, без второй системы хранения
где бы то ни было.

Смысл этого репозитория не в карте, а в форме сервиса. Это разобранный пример
того, как выглядит приложение поверх YTsaurus от начала до конца — очереди
с консьюмерами и автотримом, справочник, в который ходит потоковая джоба,
статическая таблица истории, батчевые витрины по расписанию и REST API,
который отдаёт всё это браузеру. Каждый кусок достаточно мал, чтобы прочитать
его за один присест.

## Как это работает

```text
  Wikimedia SSE (recentchange)
        │
        │  ingestor            обычный python, работает где угодно
        ▼
  {BASE}/q_raw                 очередь YTsaurus
        │
        │  spyt_enrich         потоковая SPYT-джоба на кластере:
        │                      lookup в {BASE}/dict/coords, H3-ячейка r9 на правку
        ▼
  {BASE}/q_enriched            очередь YTsaurus
        │
        ├───────────────────────────────────────────────┐
        │  archiver                                     │  поллер внутри бэкенда
        ▼                                               ▼
  {BASE}/history/t_history                        окно 30 минут в памяти
        │                                               │
        │  spyt_marts          батчевая SPYT-джоба      │  ячейки r9 сворачиваются
        ▼                                               ▼  до резолюции зума
  {BASE}/marts/trends                             GET /api/v1/hexagons/active
  {BASE}/marts/top_articles                              │
  {BASE}/marts/top_geo                                   ▼
        │                                             карта
        │  GET /api/v1/dashboard
        ▼
     дашборд
```

`{BASE}` — это `YT_BASE_PATH`, по умолчанию `//home/wikipulse`. От него
строятся все пути проекта: путей кластера в исходниках не зашито. Двумя
батчевыми шагами слева управляет `scheduler` — он раз в пять минут гоняет
`archiver`, а затем `spyt_marts`.

## Структура репозитория

```text
.
├── frontend/   React-клиент: живая карта и дашборд
├── backend/    REST API на Java / Spring Boot / Maven
├── bigdata/    пайплайн: продюсер, SPYT-джобы, создание таблиц, заливка артефактов
├── deploy/     контейнеры, Caddy, конфигурация выкладки
├── docs/       архитектура, контракты, runbooks
└── setup/      как настроить машину под YTsaurus и SPYT
```

## Что нужно

| Что | Версия | Для чего |
|---|---|---|
| JDK | 17 | `backend` — `java.version` в `backend/pom.xml` |
| Node.js | `^20.19` или `>=22.12` | `frontend` — требование Vite 8 |
| pnpm | закреплён полем `packageManager` | `frontend`, ставится через corepack |
| Python | `>=3.12` | `bigdata` — `requires-python` в `pyproject.toml` |
| Docker с плагином compose | — | `deploy` |
| Кластер YTsaurus со SPYT | — | всё, кроме профиля `mock` |
| Ключ JavaScript API Яндекс Карт | — | чтобы карта вообще отрисовалась |

Первый шаг быстрого старта работает без кластера и без ключа карт.

## Быстрый старт

### 1. Весь продукт вообще без кластера

У бэкенда есть профиль `mock`: он проигрывает настоящие правки из фикстур
в `backend/src/main/resources/fixtures/`, а H3-ячейки к ним синтетические.
Запустить его:

```bash
cd backend
SPRING_PROFILES_ACTIVE=mock ./mvnw spring-boot:run
```

и во втором терминале клиент:

```bash
cd frontend
pnpm install
pnpm dev
```

Открыть <http://localhost:5173/map>. Dev server проксирует `/api` на
`http://localhost:8080`, поэтому бэкенд должен быть поднят первым.

`YT_PROXY` и `YT_TOKEN` здесь не нужны: бины, которые их читают, помечены
`@Profile("yt")`, и плейсхолдеры на `mock` не резолвятся вовсе. А вот
`SPRING_PROFILES_ACTIVE` нужен: профиль по умолчанию — `yt`, а он ходит
в кластер по RPC. Подробности профиля —
[`docs/runbooks/local-setup.md`](docs/runbooks/local-setup.md).

Чтобы вместо экрана ошибки увидеть настоящие тайлы карты, добавь
`YMAPS_API_KEY=<ключ>` в команду бэкенда; где взять ключ и почему ему
обязательно ограничение по HTTP Referer — в
[`frontend/README.md`](frontend/README.md).

### 2. На настоящем кластере YTsaurus

```bash
export YT_PROXY=https://<proxy-host>
export YT_TOKEN=<токен>
export YT_BASE_PATH=//home/wikipulse

cd bigdata
pip install -e .

init-tables        # каталоги, очереди, консьюмеры, автотрим, история, витрины
upload-artifacts   # собрать и залить bigdata.zip, h3.zip и скрипты джоб
ingestor           # Wikimedia SSE → q_raw
```

`upload-artifacts` — не опциональное удобство: без `bigdata.zip` и `h3.zip`
в `{BASE}/lib` любая SPYT-джоба падает на кластере с
`ModuleNotFoundError: bigdata`. Справочник координат, потоковая джоба,
архиватор, витрины и шедулер — в [`bigdata/README.md`](bigdata/README.md),
в том порядке, в котором их нужно запускать.

Когда таблицы наполнены, бэкенду профиль не нужен — `yt` и так по умолчанию:

```bash
cd backend
YT_PROXY=$YT_PROXY YT_TOKEN=$YT_TOKEN YT_BASE_PATH=$YT_BASE_PATH \
  YMAPS_API_KEY=<ключ> ./mvnw spring-boot:run
```

Бэкенд ходит в YTsaurus по RPC на порт 9013, который из домашних сетей обычно
закрыт; с облачной ВМ работает. Python-часть ходит через HTTP-прокси и
работает откуда угодно.

### 3. Всё в контейнерах

```bash
cd deploy
cp .env.example .env     # заполнить YT_PROXY, YT_TOKEN, DOMAIN, ACME_EMAIL
docker compose up -d --build
```

Четыре контейнера: бэкенд, ингестор, шедулер и Caddy. SPYT-джобы работают на
кластере и в compose не входят, поэтому `upload-artifacts` должен быть уже
выполнен против этого кластера — иначе шедулеру нечего будет считать. Caddy
обслуживает ровно тот хост, который назван в `DOMAIN`, и получает на него
сертификат сам; `DOMAIN=http://localhost` выключает HTTPS, чтобы посмотреть
стенд локально. Всё остальное — TLS с файловым сертификатом, `extra_hosts`
конкретного стенда, заголовки безопасности, место на диске, известные
грабли — в [`deploy/README.md`](deploy/README.md).

## Конфигурация

Всё, что сервис берёт снаружи, приходит переменными окружения: адресов
кластера, токенов и путей в Cypress в исходниках нет. Полная таблица — какая
переменная обязательна, какие значения по умолчанию, кто что читает — это
[`docs/runbooks/configuration.md`](docs/runbooks/configuration.md), а
[`deploy/.env.example`](deploy/.env.example) — её заполняемый шаблон.

Форк меняет две вещи: кластер, в который он ходит (`YT_PROXY`, `YT_TOKEN`),
и корень, в который он пишет (`YT_BASE_PATH`).

Workflow выкладки `.github/workflows/deploy.yml` копирует исходники на сервер
и запускает там compose. **В форке он молчит:** пока переменная репозитория
`DEPLOY_HOST` не задана, job не запускается, и пример не пытается выложиться
на чужую машину. Свой хост настраивается переменными и секретами репозитория,
либо файл удаляется.

## Документация

Ведётся по-русски; задачи и pull request'ы принимаются на русском или
английском.

- [`docs/README.md`](docs/README.md) — индекс всего остального.
- [`docs/contracts/`](docs/contracts/) — границы: схемы таблиц YT и REST API.
  Если код разошёлся с ними, неправ код.
- [`docs/runbooks/local-setup.md`](docs/runbooks/local-setup.md) — длинная
  форма первого шага быстрого старта.
- [`setup/spyt-env.md`](setup/spyt-env.md) — как настроить машину на кластер
  YTsaurus и запускать с неё SPYT-джобы.

## Лицензия

Apache-2.0 — см. [LICENSE](LICENSE) и [NOTICE](NOTICE). Заголовков лицензии
в исходных файлах нет, их покрывают файлы в корне.

Компоненты, которые проект не просто использует, а распространяет дальше,
перечислены в [THIRD-PARTY.md](THIRD-PARTY.md), а тексты лицензий, отличных
от Apache-2.0, — в [THIRD-PARTY-LICENSES.txt](THIRD-PARTY-LICENSES.txt).
Обычные зависимости Maven, pnpm и pip объявлены в `backend/pom.xml`,
`frontend/package.json` и `bigdata/pyproject.toml`.

Как участвовать: [CONTRIBUTING.md](CONTRIBUTING.md).
Как сообщить об уязвимости: [SECURITY.md](SECURITY.md).
