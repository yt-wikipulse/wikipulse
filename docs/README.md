# Документация

Документация ведётся по-русски; по-английски продублирован только корневой
[README](../README.md).

## architecture — как система устроена

- [pipeline.md](architecture/pipeline.md) — компоненты, границы между ними и
  путь данных: очереди, консьюмеры, ретеншен, семантика доставки, расписание.
- [backend.md](architecture/backend.md) — устройство REST-сервиса, поллер,
  кэши живой карты и дашборда, профили `yt` и `mock`.
- [frontend.md](architecture/frontend.md) — маршруты, слои, поток данных,
  владение состоянием, стили.
- [security.md](architecture/security.md) — границы доверия, секреты, текущие
  ограничения и что обязан настроить форкер.

## contracts — границы между компонентами

- [yt-schemas.md](contracts/yt-schemas.md) — схемы таблиц и очередей YTsaurus.
- [rest-api.md](contracts/rest-api.md) — эндпоинты и форматы ответов.
- [data-sources.md](contracts/data-sources.md) — внешние источники данных и
  условия их использования.

## runbooks — как запустить и как чинить

- [local-setup.md](runbooks/local-setup.md) — локальный запуск на профиле
  `mock`, без кластера и без секретов.
- [local-cluster.md](runbooks/local-cluster.md) — локальный кластер YTsaurus,
  таблицы и бэкенд поверх него; SPYT-джобы там не запускаются.
- [configuration.md](runbooks/configuration.md) — все переменные окружения и
  ключи `application.yaml`.
- [troubleshooting.md](runbooks/troubleshooting.md) — частые проблемы.

Настройка окружения для запуска SPYT-джоб — в
[setup/spyt-env.md](../setup/spyt-env.md).

## README компонентов

- [bigdata/README.md](../bigdata/README.md) — команды пайплайна и порядок,
  в котором их запускают на кластере.
- [frontend/README.md](../frontend/README.md) — запуск клиента и ключ
  Яндекс Карт.
- [deploy/README.md](../deploy/README.md) — Docker Compose, TLS, автовыкладка.
