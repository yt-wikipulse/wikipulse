# Деплой

Всё приложение поднимается одной командой `docker compose up -d --build`:
четыре контейнера — бэкенд, ингестор, планировщик и веб с Caddy. Тот же способ
работает и на чистом клоне у любого, кто захочет запустить проект у себя.

SPYT-джобы выполняются на кластере YTsaurus и в compose не входят.

## Что нужно на машине

Docker с плагином compose. На 4 ГБ памяти стоит добавить swap, иначе сборка
образов бэкенда и фронта может упереться в OOM:

```
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Переменные

Скопировать `deploy/.env.example` в `deploy/.env` и заполнить. Файл с
реальными значениями не коммитится.

| Переменная | Смысл |
|---|---|
| `YT_PROXY`, `YT_TOKEN` | доступ к кластеру |
| `VITE_YMAPS_API_KEY` | ключ JavaScript API Яндекс Карт |
| `DOMAIN` | адрес сайта для Caddy, сейчас `example.com` |
| `ACME_EMAIL` | почта в конфиге Caddy; сертификат выпускается не через ACME |

`DOMAIN` с префиксом `http://` отключает HTTPS и редирект на него — годится,
чтобы посмотреть сайт, пока сертификата на машине нет.

## Запуск

```
cd deploy && docker compose up -d --build
```

Проверка:

```
docker compose ps
docker compose logs -f backend
curl -s "http://localhost/api/v1/hexagons/active?min_lng=-180&min_lat=-85&max_lng=180&max_lat=85&zoom=3"
```

## Сертификат

Caddy умеет получать сертификат сам, но на адресе `203.0.113.12` это не
работало: и HTTP-01, и TLS-ALPN-01 падали с `Timeout during connect (likely
firewall problem)`, хотя порты 80 и 443 были открыты в группе безопасности и
отвечали на запрос из-за границы. Настройками Caddy это не лечилось.

Тот адрес позже пришлось сменить — он оказался заблокирован для российского
трафика (см. «Блокировка IP» ниже). На текущем `203.0.113.11` выпуск через
ACME не перепроверяли: если убрать `tls` из `Caddyfile` и он заработает,
всё описанное ниже станет не нужно.

Поэтому сертификат выпускается в Certificate Manager по DNS-проверке —
она идёт через запись в зоне и входящих соединений не требует:

```
yc certificate-manager certificate request \
  --name example-com --domains example.com,www.example.com --challenge dns
yc certificate-manager certificate get --name example-com --full   # взять challenges
```

На каждый домен предлагается CNAME или TXT. Нужен **CNAME**: он остаётся
валидным при продлении, TXT пришлось бы менять руками каждые 90 дней.

```
yc dns zone add-records --name example-com \
  --record "_acme-challenge 300 CNAME <id>.cm.yandexcloud.net." \
  --record "_acme-challenge.www 300 CNAME <id>.cm.yandexcloud.net."
```

Статус дойдёт до `ISSUED` за 5–30 минут. Дальше файлы кладутся на машину в
`/opt/wikipulse/certs` — каталог вне `src`, выкладка его не трогает:

```
yc certificate-manager certificate content --name example-com \
  --chain chain.pem --key key.pem
scp chain.pem key.pem <vm>:/tmp/ && ssh <vm> '
  sudo mv /tmp/chain.pem /tmp/key.pem /opt/wikipulse/certs/
  sudo chmod 600 /opt/wikipulse/certs/key.pem'
docker compose up -d web
```

**Текущий сертификат истекает 22 ноября 2026.** Certificate Manager продлит
его сам, но на машину новые файлы не попадут — их нужно переложить этими же
командами, иначе сайт отдаст просроченный сертификат.

## Автовыкладка

`.sourcecraft/ci.yaml` при пуше в `main` копирует исходники на сервер в
`/opt/wikipulse/src` и выполняет там `docker compose up -d --build`. Нужен
секрет `DEPLOY_SSH_KEY` — приватный ключ без passphrase, публичная часть
лежит в `~/.ssh/authorized_keys` на сервере.

`deploy/.env` при копировании исключён: секреты остаются на сервере и через
CI не проходят.

## Грабли, на которые уже наступили

**Docker Hub недоступен из ru-central1.** Прямой доступ к `registry-1.docker.io`
не проходит, и `docker compose build` падает с `DeadlineExceeded ... failed to
resolve source metadata` — выглядит как проблема сети или Dockerfile, хотя дело
в блокировке. Лечится зеркалами в `/etc/docker/daemon.json`:

```json
{
  "registry-mirrors": [
    "https://mirror.gcr.io",
    "https://dockerhub.timeweb.cloud",
    "https://huecker.io"
  ]
}
```

После правки нужен `sudo systemctl restart docker`. Проверка — `docker info |
grep -A4 "Registry Mirrors"` и реальный `docker pull alpine`. Зеркало
`cr.yandex/mirror` не подходит: адрес отвечает, но образы отдаёт как `not found`.

Это настройка машины, а не репозитория: на новом сервере её придётся сделать
заново.

**npm-реестр тоже недоступен.** `registry.npmjs.org` из ru-central1 не
отвечает, и сборка `web` падает на `pnpm install` с `ETIMEDOUT`, ещё до
установки зависимостей — corepack не может скачать сам pnpm. В
`web.Dockerfile` прописано зеркало `registry.npmmirror.com` двумя
переменными: `COREPACK_NPM_REGISTRY` для corepack и `NPM_CONFIG_REGISTRY`
для pnpm. Одной недостаточно.

**Репозитории Debian тоже недоступны.** `deb.debian.org` из ru-central1 не
отвечает, и установка пакетов внутри образа падает с `Unable to locate package`,
хотя пакет существует. В `bigdata.Dockerfile` источники переключены на
`mirror.yandex.ru` — то же зеркало, на которое настроен сам сервер. При
добавлении apt-пакетов в другие образы придётся сделать так же.

**Блокировка IP.** Публичный адрес Yandex Cloud может оказаться заблокирован
для российского трафика: `203.0.113.12` не отвечал из РФ ни на одном порту,
включая 22, а из-за границы работал полностью. Выглядит как поломка ВМ, но
лечится только сменой адреса — выделить новый, остановить ВМ,
`remove-one-to-one-nat` + `add-one-to-one-nat --nat-address <новый>`,
запустить, поправить A-записи. Сертификат при этом остаётся валидным: он
выдан на домен. Проверять доступность обязательно **без VPN** командой
`nc -vz <ip> 22`: под VPN проверка врёт — прокси отвечает вместо сервера и
показывает открытый порт там, где его нет.

**Сайт открывается только по DOMAIN.** Caddy обслуживает ровно тот адрес,
что указан в `.env`. Запрос по IP-адресу или любому другому имени получит
пустой ответ с кодом 200. Это не поломка, а следствие конфигурации: у проекта
один канонический адрес.


**RPC-порт кластера.** Java-бэкенд и `spark-submit` ходят в YTsaurus по RPC на
порт 9013. Из домашних сетей он обычно закрыт: соединение не устанавливается,
клиент падает с `AcknowledgementTimeoutException`. С облачной ВМ работает.
HTTP-прокси кластера доступен отовсюду, поэтому `yt` CLI и ингестор
(Python, HTTP) работают везде, а бэкенд — только с сервера.

**Поток Wikimedia.** DNS отдаёт европейский узел `esams`, до которого из
ru-central1 нет маршрута. В `compose.yml` прописан узел `eqiad`
(`208.80.154.224`) — без этой строки ингестор молча не получает событий.

**Ключ Яндекс Карт.** Для JavaScript API 3.0 ограничение по HTTP Referer
обязательно, иначе ключ не работает нигде. Голый IP-адрес кабинет не
принимает — нужен домен, сейчас это `example.com`. Формат поля — только
хост, без схемы и без `/*`. Referer нужно прописать ключу из
`VITE_YMAPS_API_KEY`, иначе карта не загрузится. Ключ подставляется в бандл
на сборке образа, поэтому его смена требует пересборки `web`.

Бесплатный тариф ключа — 100 запросов в сутки, каждая загрузка страницы
тратит один.

**Планировщик тянет за собой Java и SPYT.** Он считает витрины через
`spark-submit`, и без него падает целиком — не пропускает шаг, а именно
падает, уходя в цикл перезапусков. Поэтому в `bigdata.Dockerfile` стоят
Java 17, `pyspark` и `ytsaurus-spyt` версий из гайда кластера, а также
`SPARK_CONF_DIR`. Образ из-за этого весит около гигабайта.

**Осиротевшие контейнеры.** Если сервис убрали из `compose.yml`, его
контейнер сам не исчезнет и продолжит работать. Поэтому выкладка идёт с
`--remove-orphans` — иначе на сервере тихо живут процессы от прошлых версий.

**Флаги бэкенда.** В `application.yaml` лежат значения для разработки: окно
выключено, очередь читается с начала. На проде это приводит к безграничному
росту кэша. Продуктовые значения передаются в `compose.yml` аргументами
запуска и переопределяют конфиг.

## Место на диске

Образ планировщика весит около гигабайта, и каждая пересборка оставляет слои
в кэше. На диске в 20 ГБ это заметно: посмотреть, сколько занято, и почистить
лишнее можно так:

```
docker system df
docker builder prune -f
docker image prune -f
```

Первая команда показывает занятое место и сколько из него освобождаемо,
остальные две убирают кэш сборки и образы без контейнеров. Работающие
контейнеры они не трогают.

## Диагностика

```
docker compose ps
docker compose logs --tail 50 backend
docker compose logs --tail 50 ingestor
```

Карта пустая, ошибок нет — проверить, наполняется ли очередь:

```
yt select-rows "max(event_ts) as t from [//home/wikipulse/q_enriched] group by 1" --format json
```

Если последнее событие давнее — встал либо ингестор, либо SPYT-джоба
`spyt_enrich` на кластере.
