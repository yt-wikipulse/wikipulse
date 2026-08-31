# Деплой

Всё приложение поднимается одной командой `docker compose up -d --build`:
четыре контейнера — бэкенд, ингестор, шедулер и веб с Caddy. SPYT-джобы
выполняются на кластере YTsaurus и в compose не входят.

Кластера у форка обычно нет. Поднять YTsaurus на своей машине —
[docs/runbooks/local-cluster.md](../docs/runbooks/local-cluster.md),
посмотреть продукт вообще без кластера —
[docs/runbooks/local-setup.md](../docs/runbooks/local-setup.md).

## Что нужно на машине

Docker с плагином compose. На машине с 4 ГБ памяти добавьте swap, иначе
сборка образов бэкенда и фронтенда может упереться в OOM:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Переменные

Скопируйте `deploy/.env.example` в `deploy/.env` и заполните: `YT_PROXY`,
`YT_TOKEN`, `YT_BASE_PATH`, `YMAPS_API_KEY`, `DOMAIN`, `ACME_EMAIL`,
`WIKIPULSE_CONTACT`. Что обязательно и какие значения по умолчанию —
[docs/runbooks/configuration.md](../docs/runbooks/configuration.md). Файл
с реальными значениями не коммитится.

`DOMAIN` с префиксом `http://` отключает HTTPS и редирект на него — годится,
чтобы посмотреть сайт локально, пока домена и сертификата нет.

Обязательные переменные записаны в `compose.yml` как `${YT_PROXY:?}`. Если
переменной нет или она пустая, compose останавливается и называет её по имени,
а не поднимает контейнеры, которые упадут минутой позже где-то в логах.
Поэтому `docker compose config` на свежем клоне без `.env` — это не поломка,
а тот самый отказ. Проверить конфигурацию, ничего не заполняя, можно
прямо на шаблоне:

```bash
docker compose --env-file .env.example config
```

То же самое вместе с `caddy validate` для `Caddyfile` делает job
`deploy-config` в `.github/workflows/ci.yml`.

## Запуск

**Один раз перед первым запуском** на кластере должны появиться таблицы и
артефакты SPYT:

```bash
init-tables        # каталоги, очереди, консьюмеры, витрины
upload-artifacts   # bigdata.zip, h3.zip и скрипты джоб в {YT_BASE_PATH}/lib и /src
```

Обе команды приходят с пакетом `bigdata` (`pip install -e bigdata`) и
выполняются с машины, у которой есть доступ к кластеру. Без
`upload-artifacts` контейнер `scheduler` упадёт с
`ModuleNotFoundError: bigdata`: `spark-submit`
отправляет джобу на кластер, а модуля там нет. Подробности —
в [bigdata/README.md](../bigdata/README.md).

```bash
cd deploy && docker compose up -d --build
```

Проверка:

```bash
docker compose ps
docker compose logs -f backend
curl -s "https://<DOMAIN>/api/v1/hexagons/active?min_lng=-180&min_lat=-85&max_lng=180&max_lat=85&zoom=3"
```

Проверять нужно именно по адресу из `DOMAIN`: Caddy обслуживает только его,
запрос на `http://localhost` вернёт пустой ответ с кодом 200.

## Локальные отличия стенда: `compose.override.yml`

`compose.yml` описывает конфигурацию, которая работает на любой машине. Всё,
что верно только для конкретного стенда, выносится в
`compose.override.yml.example`: скопировать в `compose.override.yml`, и compose
подхватит его автоматически. Там два блока.

**`extra_hosts`.** RPC-прокси кластера YTsaurus в Kubernetes может не
резолвиться публичным DNS, а `stream.wikimedia.org` резолвится в ближайший
узел, до которого из вашей сети может не быть маршрута. Адреса в примере —
заглушки из документационной сети `203.0.113.0/24` (RFC 5737), рабочих
значений в репозитории нет. Свои берутся из `kubectl -n <namespace> get svc`
для прокси и `dig stream.wikimedia.org` из нужного региона для потока.

**Файловый сертификат.** См. следующий раздел.

## TLS

По умолчанию Caddy выпускает сертификат сам: `Caddyfile` не содержит директивы
`tls`, включается автоматический HTTPS по адресу из `DOMAIN`. На чистом форке
это работает без подготовки.

Если автоматический выпуск не проходит, `Caddyfile` подключает свои настройки
TLS через `import /etc/caddy/tls/*.caddy` — glob, который при отсутствии
файлов даёт предупреждение, а не ошибку. Чтобы подложить готовые файлы
сертификата:

```bash
cp deploy/tls-file.caddy.example deploy/tls-file.caddy
cp deploy/compose.override.yml.example deploy/compose.override.yml
```

Оверрайд монтирует сниппет в `/etc/caddy/tls/` и каталог с `chain.pem` и
`key.pem` в `/etc/caddy/certs/`. Файловый сертификат дороже в эксплуатации:
продление и перекладку файлов на машину приходится держать в голове.

## Заголовки безопасности

Блок `header` в `Caddyfile` отдаёт HSTS, `X-Content-Type-Options: nosniff`,
`Referrer-Policy`, `Cross-Origin-Opener-Policy` и CSP.

CSP собрана под то, что реально грузит фронтенд: карты (`api-maps.yandex.ru`,
тайлы `*.maps.yandex.net`, статика `yastatic.net`), картинки и API Википедии
(`*.wikipedia.org`, `upload.wikimedia.org`) и собственный origin.
`frame-ancestors 'none'` запрещает встраивание в чужой iframe, `object-src
'none'` — плагины. `'wasm-unsafe-eval'` нужен движку карт, полный
`'unsafe-eval'` не включён. `style-src` вынужденно с `'unsafe-inline'`: React
и framer-motion расставляют стили атрибутом `style`.

Три источника стоят в политике из-за движка карт, и убирать их нельзя:
`yastatic.net` в `style-src` — оттуда приезжает таблица стилей карты;
`*.api-maps.yandex.ru` в `connect-src` — туда уходит телеметрия, а запись
`https://api-maps.yandex.ru` поддомены не покрывает; `data:` в `worker-src` —
воркеры создаются из data-URI, а не загружаются с хоста. Без любого из трёх
карта не рисуется и показывает экран ошибки.

`script-src` строгий, и инлайновых скриптов в `frontend/index.html` нет:
фавиконка переключается под тему системы двумя тегами `<link rel="icon">`
с атрибутом `media`, без JavaScript. Браузер, который `media` на иконках
не учитывает, берёт светлый вариант.

Если карта не рисуется, смотрите консоль браузера: нарушение CSP видно там
явно и лечится добавлением домена в нужную директиву.

Границы доверия и секреты —
в [docs/architecture/security.md](../docs/architecture/security.md).

## Автовыкладка

`.github/workflows/deploy.yml` при пуше в `main` копирует исходники на сервер
и выполняет там `docker compose up -d --build --remove-orphans`. Запускается
только после зелёного `CI` — через `workflow_run`, а не параллельно с ним.

**Форкеру этот workflow не нужен.** Пока переменная `DEPLOY_HOST` не задана,
job не запускается — молча выкладываться на чужую машину пример не будет.
Если автовыкладка не нужна совсем, удалите файл.

Настройка в Settings → Secrets and variables → Actions:

| Имя | Тип | Значение |
|---|---|---|
| `DEPLOY_HOST` | variable | адрес или DNS-имя сервера |
| `DEPLOY_USER` | variable | пользователь на сервере |
| `DEPLOY_DIR` | variable | каталог с исходниками, например `/opt/wikipulse/src` |
| `DEPLOY_SSH_KEY` | secret | приватный ключ без passphrase; публичная часть — в `~/.ssh/authorized_keys` на сервере |
| `DEPLOY_HOST_FINGERPRINT` | secret | строка `known_hosts` сервера |

Отпечаток снимается человеком с доверенной машины и сверяется с тем, что
показывает консоль сервера; workflow берёт его из секрета и `ssh-keyscan`
не выполняет.

```bash
ssh-keyscan -t ed25519 <host>
```

Из `rsync --delete` исключены `deploy/.env`, `deploy/compose.override.yml` и
`deploy/tls-file.caddy`: это локальная конфигурация стенда, её в репозитории
нет, и без исключения выкладка стёрла бы её на сервере. Секреты при этом
остаются на сервере и через CI не проходят.

Образы собираются на боевой машине: выкладка отправляет исходники и
запускает `docker compose --build` прямо там. Сервер тратит на сборку память
и место, а откат возможен только пересборкой с прошлого коммита.

## Образы

**Непривилегированный пользователь.** `backend.Dockerfile` и
`bigdata.Dockerfile` заводят пользователя `app` (uid 10001) и переключаются
на него в конце. `web.Dockerfile` оставлен как есть: официальный образ Caddy
работает от root и слушает 80/443, поэтому в `compose.yml` у него сняты все
capability, кроме `NET_BIND_SERVICE`. У остальных сервисов `cap_drop: ALL`
без исключений, и у всех выставлен `no-new-privileges`.

**Зеркала реестров.** Если из вашей сети не отвечают `registry.npmjs.org` или
`deb.debian.org`, сборке нужны зеркала. Они вынесены в `ARG` с дефолтом на
официальные адреса, чтобы на обычной машине сборка шла напрямую:

```bash
docker compose build \
  --build-arg NPM_REGISTRY=https://registry.npmmirror.com \
  --build-arg DEBIAN_MIRROR=http://mirror.yandex.ru
```

Для npm зеркало прописывается двумя переменными: `COREPACK_NPM_REGISTRY` для
corepack, который скачивает сам pnpm, и `NPM_CONFIG_REGISTRY` для pnpm. Одной
недостаточно — без первой сборка падает на `ETIMEDOUT` ещё до установки
зависимостей.

## Грабли

**Docker Hub может быть недоступен.** Если прямой доступ к
`registry-1.docker.io` не проходит, `docker compose build` падает с
`DeadlineExceeded ... failed to resolve source metadata` — выглядит как
проблема сети или Dockerfile. Лечится зеркалами в `/etc/docker/daemon.json`:

```json
{
  "registry-mirrors": ["https://mirror.gcr.io", "https://dockerhub.timeweb.cloud"]
}
```

После правки нужен `sudo systemctl restart docker`. Проверка — `docker info |
grep -A4 "Registry Mirrors"` и реальный `docker pull alpine`. Зеркало
проверяйте на настоящем pull: адрес может отвечать, но отдавать образы как
`not found` (так ведёт себя `cr.yandex/mirror`). Это настройка машины, а не
репозитория: на новом сервере её придётся сделать заново.

**Сайт открывается только по DOMAIN.** Caddy обслуживает ровно тот адрес,
что указан в `.env`. Запрос по IP-адресу или любому другому имени получит
пустой ответ с кодом 200. Это не поломка, а следствие конфигурации: у проекта
один канонический адрес.

**RPC-порт кластера.** Java-бэкенд и `spark-submit` ходят в YTsaurus по RPC на
порт 9013. Из домашних сетей он обычно закрыт: соединение не устанавливается,
клиент падает с `AcknowledgementTimeoutException`. С облачной ВМ работает.
HTTP-прокси кластера доступен отовсюду, поэтому `yt` CLI и ингестор
(Python, HTTP) работают везде, а бэкенд — только с сервера.

**Поток Wikimedia.** DNS может отдать узел, до которого из вашей сети нет
маршрута; тогда ингестор молча не получает событий. Лечится записью в
`extra_hosts` — см. `compose.override.yml.example`.

**Ключ Яндекс Карт.** Для JavaScript API 3.0 ограничение по HTTP Referer
обязательно, иначе ключ не работает нигде. Голый IP-адрес кабинет не
принимает — нужен домен. Формат поля — только хост, без схемы и без `/*`.
Ключ живёт в окружении бэкенда и уходит фронту по `GET /api/v1/config`,
поэтому его смена требует только `docker compose up -d backend`, без
пересборки `web`. Бесплатный тариф — 100 загрузок карты в сутки.

**Шедулер тянет за собой Java и SPYT.** Он считает витрины через
`spark-submit` и без него падает целиком, уходя в цикл перезапусков. Поэтому
в `bigdata.Dockerfile` стоят Java 17, `pyspark` и `ytsaurus-spyt` версий из
гайда кластера, а также `SPARK_CONF_DIR`: без него `spark-submit` не понимает
адрес кластера и падает с «Master must either be yarn or start with spark,
k8s, or local». Базовый образ — `bookworm`, а не `slim`: в Debian 13 пакета
`openjdk-17` уже нет. Образ весит около гигабайта, и каждая пересборка
оставляет слои в кэше — на диске в 20 ГБ это заметно. Занятое место
показывает `docker system df`, освобождают его `docker builder prune -f`
и `docker image prune -f`.

**Осиротевшие контейнеры.** Если сервис убрали из `compose.yml`, его
контейнер сам не исчезнет и продолжит работать. Поэтому выкладка идёт с
`--remove-orphans`.

## Диагностика

```bash
docker compose ps
docker compose logs --tail 50 backend
docker compose logs --tail 50 ingestor
```

Карта пустая, ошибок нет — проверьте, наполняется ли очередь:

```bash
yt select-rows "max(event_ts) as t from [$YT_BASE_PATH/q_enriched] group by 1" --format json
```

Если последнее событие давнее — встал либо ингестор, либо SPYT-джоба
`spyt_enrich` на кластере.
