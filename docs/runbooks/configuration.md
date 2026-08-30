# Конфигурация

Все переменные окружения проекта в одном месте. Если переменной нет в этой
таблице — её не читает никакой код репозитория.

Где задавать: локально — [local-setup.md](local-setup.md) и
[local-cluster.md](local-cluster.md), на сервере — `deploy/.env` (шаблон
`deploy/.env.example`), для работы с кластером руками —
[setup/spyt-env.md](../../setup/spyt-env.md).

## Переменные окружения

| Переменная | Кто читает | Обязательна | По умолчанию | Пример |
|---|---|---|---|---|
| `YT_PROXY` | backend на профиле `yt`, все команды `bigdata` | да, кроме профиля `mock` | нет | `my-cluster.example.com` для бэкенда, `https://my-cluster.example.com` для `bigdata` |
| `YT_TOKEN` | backend на профиле `yt`, все команды `bigdata` | да, кроме профиля `mock` | нет | токен из веб-интерфейса кластера |
| `YT_BASE_PATH` | backend, `bigdata` | нет | `//home/wikipulse` | `//home/alice/wikipulse` |
| `YMAPS_API_KEY` | backend | нет | пусто | ключ из Кабинета разработчика, UUID |
| `WIKIPULSE_CONTACT` | `bigdata`, попадает в `User-Agent` запросов к Wikimedia | нет | `https://github.com/yt-wikipulse/wikipulse` | `https://github.com/<you>/wikipulse` |
| `SPRING_PROFILES_ACTIVE` | backend | нет | `yt` (`spring.profiles.default`) | `mock` |
| `BACKEND_URL` | `frontend/vite.config.ts`, только `pnpm dev` | нет | `http://localhost:8080` | `http://localhost:9090` |
| `DOMAIN` | `deploy/compose.yml`, оттуда в `Caddyfile` | да для `docker compose` | нет | `example.com`, `http://localhost` |
| `ACME_EMAIL` | `deploy/compose.yml`, оттуда в `Caddyfile` | да для `docker compose` | нет | `admin@example.com` |
| `SPARK_CONF_DIR` | `spark-submit` | да для SPYT-джоб | нет | каталог `conf` внутри пакета `spyt` |
| `SPYT_DEPS_ZIP` | `bigdata/jobs/scheduler.py` | нет | пусто | архив зависимостей SPYT, уезжает в `--py-files` первым |
| `YT_SECURE_VAULT_YT_TOKEN` | `bigdata` внутри операции на кластере | задаёт YTsaurus, человек — нет | нет | — |

В рантайме фронтенд переменных окружения не использует: ключ карт приезжает
с бэкенда по `GET /api/v1/config`, а `BACKEND_URL` читает только конфиг Vite
при `pnpm dev` — прокси объявлен для `server`, а не для `preview`.

### Что важно помнить

**`YT_PROXY` без схемы означает `https://`.** И бэкенд
(`repository/YtProxy.java`), и `bigdata` (`runtime.proxy_url`) дописывают её
одинаково. Локальному кластеру по HTTP схему надо писать явно: без неё
клиент пойдёт на 443 и не достучится.

**На профиле `mock` не нужно ничего.** `YT_PROXY` и `YT_TOKEN` подставляются
в бины `QEnrichedRepository` и `YtAggregatesRepository` с `@Profile("yt")` —
на `mock` они не создаются, и плейсхолдеры не резолвятся.

**`YMAPS_API_KEY` пустой — рабочее состояние.** Бэкенд стартует и отдаёт
данные, карта показывает экран ошибки. Ключ уходит фронту в ответе
`GET /api/v1/config`, поэтому его смена требует перезапуска бэкенда, но не
пересборки фронта.

**`YT_SECURE_VAULT_YT_TOKEN` руками не задают:** YTsaurus кладёт его в
окружение операции сам, а `bigdata` читает сначала `YT_TOKEN`, потом его.

## Ключи `application.yaml`

Продуктовые значения бэкенда — дефолты в
`backend/src/main/resources/application.yaml`.

| Ключ | Значение | Смысл |
|---|---|---|
| `app.live.window-minutes` | 30 | окно кэша живой карты; события старше выпадают |
| `app.live.zoom-min` / `zoom-max` | 0 / 30 | границы допустимого `zoom` в запросе; за ними 400 |
| `app.live.zoom-r3-max` … `zoom-r8-max` | 6, 7, 9, 11, 13 | лестница зума, см. ниже |
| `app.live.hexagon-events-cap` | 50 | максимум событий в массиве `events` одного гексагона; на счётчик `events_count` не влияет |
| `app.poller.interval-ms` | 500 | период тика `YtQueuePoller` |
| `app.poller.max-pages-per-tick` | 10 | сколько страниц очереди поллер вычитывает за тик |
| `app.enrich.fetch-batch` | 1000 | размер страницы чтения `q_enriched`; в файле не объявлен, значение живёт дефолтом в `QEnrichedRepository` |
| `app.ymaps.api-key` | `${YMAPS_API_KEY:}` | ключ, который уезжает в `GET /api/v1/config` |
| `yt.base-path` | `${YT_BASE_PATH://home/wikipulse}` | корень всех путей в YT |
| `yt.table.*` | `${yt.base-path}/…` | пути таблиц; литералов в коде нет |
| `spring.jackson.property-naming-strategy` | `SNAKE_CASE` | превращает camelCase-поля записей в snake_case контракта REST |
| `spring.profiles.default` | `yt` | профиль, если `SPRING_PROFILES_ACTIVE` не задан |

**Лестница зума.** `H3GeoService.resolutionZoom` переводит зум карты в
резолюцию H3 ступенями: `zoom <= zoom-r3-max` → 3, дальше так же 4, 5, 6,
`zoom-r6-max < zoom <= zoom-r8-max` → 8, `zoom > zoom-r8-max` → 9. Резолюция
7 пропущена. Чем ближе приближена карта, тем мельче гексагон.

**Тестовый `application.yaml` заменяет основной, а не дополняет.**
`backend/src/test/resources/application.yaml` попадает в classpath раньше, и
`classpath:/application.yaml` резолвится в один ресурс. Добавил в основной
файл ключ, важный для тестов, — продублируй в тестовый.

## Переменные и секреты GitHub Actions

Нужны только для автовыкладки: пока `DEPLOY_HOST` не задана, workflow не
запускается. Порядок настройки — в [deploy/README.md](../../deploy/README.md).

| Имя | Тип | Значение |
|---|---|---|
| `DEPLOY_HOST` | variable | адрес или DNS-имя сервера |
| `DEPLOY_USER` | variable | пользователь на сервере |
| `DEPLOY_DIR` | variable | каталог с исходниками, например `/opt/wikipulse/src` |
| `DEPLOY_SSH_KEY` | secret | приватный ключ без passphrase |
| `DEPLOY_HOST_FINGERPRINT` | secret | строка `known_hosts` сервера |

## Аргументы сборки образов

Это `--build-arg`: они действуют только во время `docker compose build`.

| Аргумент | Где | По умолчанию | Зачем |
|---|---|---|---|
| `NPM_REGISTRY` | `deploy/web.Dockerfile` | `https://registry.npmjs.org` | зеркало npm, если официальный реестр недоступен |
| `DEBIAN_MIRROR` | `deploy/bigdata.Dockerfile` | `http://deb.debian.org` | зеркало apt по той же причине |
