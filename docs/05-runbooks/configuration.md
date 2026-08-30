# Конфигурация

Все переменные окружения проекта в одном месте: кто их читает, обязательны ли
они и что произойдёт без них. Если переменной нет в этой таблице — её не
читает никакой код репозитория.

Как задать значения: локально — [local-setup.md](local-setup.md) и
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
| `DOMAIN` | `deploy/compose.yml`, оттуда в `Caddyfile` | да для `docker compose` | нет | `example.com`, `http://localhost` |
| `ACME_EMAIL` | `deploy/compose.yml`, оттуда в `Caddyfile` | да для `docker compose` | нет | `admin@example.com` |
| `SPARK_CONF_DIR` | `spark-submit` | да для SPYT-джоб | нет | каталог `conf` внутри пакета `spyt` |
| `YT_SECURE_VAULT_YT_TOKEN` | `bigdata` внутри операции на кластере | задаёт YTsaurus, человек — нет | нет | — |

| `BACKEND_URL` | `frontend/vite.config.ts` | нет | `http://localhost:8080` | `http://localhost:9090` |

Больше в коде ничего не читается. В рантайме фронтенд переменных окружения не
использует вовсе: ключ карт приезжает с бэкенда по `GET /api/v1/config`, а
`BACKEND_URL` читается только конфигом Vite при `pnpm dev` — на прод-сборку
она не влияет, потому что прокси объявлен для `server`, а не для `preview`.

### Что важно помнить

**`YT_PROXY` пишется по-разному для бэкенда и для `bigdata`.** Java-клиент
получает адрес как есть (`YTsaurusClient.builder().setCluster(...)`), а
`bigdata/src/bigdata/runtime.py` дописывает `https://`, если схемы нет. На
обычном кластере разница незаметна, на локальном по HTTP — ломает `bigdata`,
поэтому там нужен явный `http://`.

**На профиле `mock` не нужно ничего.** `YT_PROXY` и `YT_TOKEN` подставляются
в бины `QEnrichedRepository` и `YtAggregatesRepository`, а они помечены
`@Profile("yt")` — на `mock` не создаются, и плейсхолдеры не резолвятся.
Проверено: контекст поднимается с пустым окружением.

**`YMAPS_API_KEY` пустой — это рабочее состояние.** Бэкенд стартует и отдаёт
данные, карта показывает экран ошибки. Ключ уходит фронту в ответе
`GET /api/v1/config`, поэтому его смена требует перезапуска бэкенда, но не
пересборки фронта.

**`YT_SECURE_VAULT_YT_TOKEN` руками не задают.** YTsaurus кладёт его в
окружение операции сам, если токен передан через secure vault. Так токен не
попадает ни в спеку операции, ни в Spark UI. `bigdata` читает сначала
`YT_TOKEN`, потом эту переменную.

## Ключи `application.yaml`

Продуктовые значения бэкенда — дефолты в
`backend/src/main/resources/application.yaml`. Переопределять их через
`--app.…=…` в `deploy/compose.yml` не нужно и не принято: если значение
годится для прода, оно должно лежать в файле.

| Ключ | Значение | Смысл |
|---|---|---|
| `app.live.window-minutes` | 30 | окно кэша живой карты; события старше выпадают |
| `app.live.zoom-min` / `zoom-max` | 0 / 30 | границы допустимого `zoom` в запросе; за ними 400 |
| `app.live.zoom-r3-max` … `zoom-r8-max` | 6, 7, 9, 11, 13 | лестница зума, см. ниже |
| `app.live.hexagon-events-cap` | 50 | максимум событий в массиве `events` одного гексагона |
| `app.poller.interval-ms` | 500 | период тика `YtQueuePoller` |
| `app.poller.max-pages-per-tick` | 10 | сколько страниц очереди поллер вычитывает за тик |
| `app.enrich.fetch-batch` | 1000 | размер страницы чтения `q_enriched`; в файле не объявлен, значение живёт дефолтом в `QEnrichedRepository` |
| `yt.base-path` | `${YT_BASE_PATH://home/wikipulse}` | корень всех путей в YT |
| `yt.table.*` | `${yt.base-path}/…` | пути таблиц; литералов в коде нет |
| `spring.jackson.property-naming-strategy` | `SNAKE_CASE` | превращает camelCase-поля записей в snake_case контракта REST |
| `spring.profiles.default` | `yt` | профиль, если `SPRING_PROFILES_ACTIVE` не задан |

**Лестница зума.** `H3GeoService.resolutionZoom` переводит зум карты в
резолюцию H3 ступенями: `zoom <= zoom-r3-max` → резолюция 3;
`zoom-r3-max < zoom <= zoom-r4-max` → 4; дальше так же для 5, 6 и 8;
`zoom > zoom-r8-max` → 9. Чем ближе приближена карта, тем мельче гексагон.
Нижняя граница `zoom-min: 0` — карта начинается с нуля, то есть со всего
мира; `zoom-max: 30` — потолок.

**Два ключа, которые нельзя трогать не подумав.**
`spring.jackson.property-naming-strategy` — единственное, что превращает
camelCase-поля записей в snake_case контракта: смена ломает фронт без единой
ошибки на бэкенде. `app.live.hexagon-events-cap` ограничивает длину списка
`events`, но не счётчик `events_count` — уменьшив его, вы урежете выдачу, а
не нагрузку на кэш.

Тестовый `backend/src/test/resources/application.yaml` не дополняет основной,
а полностью его заменяет: `test-classes` стоит в classpath раньше, и
`classpath:/application.yaml` резолвится в один-единственный ресурс. Правило:
добавил в основной `application.yaml` ключ, важный для тестов, — продублируй
в тестовый.

Почему значения именно такие — в
[backend-implementation-notes.md](../02-architecture/backend-implementation-notes.md),
пункты привязаны к файлу и символу.

## Переменные и секреты GitHub Actions

Нужны только для автовыкладки. Пока `DEPLOY_HOST` не задана, workflow не
запускается — форк получает работающий CI и молчащий деплой. Подробности и
порядок настройки — в [deploy/README.md](../../deploy/README.md).

| Имя | Тип | Значение |
|---|---|---|
| `DEPLOY_HOST` | variable | адрес или DNS-имя сервера |
| `DEPLOY_USER` | variable | пользователь на сервере |
| `DEPLOY_DIR` | variable | каталог с исходниками, например `/opt/wikipulse/src` |
| `DEPLOY_SSH_KEY` | secret | приватный ключ без passphrase |
| `DEPLOY_HOST_FINGERPRINT` | secret | строка `known_hosts` сервера |

## Аргументы сборки образов

Это `--build-arg`, а не переменные окружения: они действуют только во время
`docker compose build`.

| Аргумент | Где | По умолчанию | Зачем |
|---|---|---|---|
| `NPM_REGISTRY` | `deploy/web.Dockerfile` | `https://registry.npmjs.org` | зеркало npm, если официальный реестр недоступен |
| `DEBIAN_MIRROR` | `deploy/bigdata.Dockerfile` | `http://deb.debian.org` | зеркало apt по той же причине |
