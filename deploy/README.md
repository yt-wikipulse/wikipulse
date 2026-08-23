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
| `DOMAIN` | адрес сайта для Caddy |
| `ACME_EMAIL` | почта для Let's Encrypt |

`DOMAIN` с префиксом `http://` отключает выпуск сертификата — так проще
начинать. Без префикса Caddy сам получит сертификат на этот домен.

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
принимает — нужен домен. Пока своего нет, годится `203.0.113.12.nip.io`:
такие домены резолвятся в зашитый в имя адрес. Ключ подставляется в
`index.html` на сборке образа, поэтому его смена требует пересборки `web`.

Бесплатный тариф ключа — 100 запросов в сутки, каждая загрузка страницы
тратит один.

**Витрины из контейнера не считаются.** Планировщик гоняет два шага:
переливку `q_enriched` в `t_history` и расчёт витрин через `spyt_marts`.
Первый работает, второй требует `spark-submit`, которого в образе
`python:3.12-slim` нет — в логах будет предупреждение «spark-submit не найден
в PATH». Пока витрины считаются с машины разработчика; чтобы считались на
сервере, в `bigdata.Dockerfile` нужно добавить Java и SPYT, а это плюс
примерно полгигабайта к образу.

**Флаги бэкенда.** В `application.yaml` лежат значения для разработки: окно
выключено, очередь читается с начала. На проде это приводит к безграничному
росту кэша. Продуктовые значения передаются в `compose.yml` аргументами
запуска и переопределяют конфиг.

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
