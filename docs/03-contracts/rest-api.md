# Контракт: REST API

> Карта статична, один фиксированный H3-resolution на бэке.

## 1. Общие правила

- Базовый путь: `/api`.
- Формат: JSON, имена полей – `snake_case`.
- Время: ISO 8601 UTC.
- Свежие данные – REST-поллинг раз в 2-3 секунды.
- Ошибки – Problem Details:

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "window must be one of 1h, 24h, 7d"
}
```

## 2. Общие query-параметры

| Параметр | Тип | Дефолт | Где применяется |
|---|---|---|---|
| `window` | `1h \| 24h \| 7d` | `24h` | только у дашборд-эндпоинтов |
| `lang` | CSV string, напр. `en,ru` | все разделы | все эндпоинты |
| `include_bots` | boolean | `false` | все эндпоинты |
| `limit` | number | `20` | только у `/api/dashboard/top-places` |

`resolution` не является query-параметром – бэк отдает фиксированный уровень H3.

## 3. Общие модели

### Hotspot

Агрегат активности внутри H3-ячейки за живое окно (60 сек – столько хранит
`RecentEditsCache` на бэке).

| Поле | Тип | Описание |
|---|---|---|
| `h3` | string | индекс H3-ячейки |
| `resolution` | number | резолюция ячейки, одно и то же значение для всех записей |
| `center` | `{ lat: number, lon: number }` | координаты центра ячейки |
| `edits_count` | number | число правок за окно |
| `users_count` | number | число уникальных редакторов за окно |
| `last_event_at` | string (ISO 8601) | время последней правки в ячейке |

### Edit

Отдельная правка – только в деталях ячейки.

| Поле | Тип | Описание |
|---|---|---|
| `edit_id` | string | стабильный id правки (бэк: `event_id`) |
| `title` | string | заголовок статьи |
| `url` | string | ссылка на статью, собирается бэком из `domain` + `title` |
| `lang` | string | языковой раздел (`en`, `ru`, ...) |
| `country_qid` | string \| null | Wikidata QID страны места, без резолва в название |
| `place_type_qid` | string \| null | Wikidata QID типа места (бэк: `type_qid`), без резолва |
| `type` | `"edit"` | значение всегда `edit` |
| `bot` | boolean | правка от бота |
| `delta_len` | number | `length_new - length_old`, байт |
| `user` | string \| null | логин редактора |
| `edited_at` | string (ISO 8601) | время правки (бэк: `event_ts`, конвертирует backend-2) |

### Page

Строка топа статей внутри ячейки.

| Поле | Тип |
|---|---|
| `title` | string |
| `url` | string |
| `lang` | string |
| `edits_count` | number |

## 4. Карта

### `GET /api/hotspots`

Снэпшот текущей активности по H3-ячейкам. Фронт опрашивает раз в 2-3 сек.
Resolution фиксирован на бэке, клиент его не выбирает.

Query: `lang`, `include_bots`.

```json
{
  "meta": {
    "generated_at": "2026-08-04T13:54:37Z",
    "window_seconds": 60,
    "resolution": 6
  },
  "data": [
    {
      "h3": "861c1c97fffffff",
      "resolution": 6,
      "center": { "lat": 48.858, "lon": 2.294 },
      "edits_count": 142,
      "users_count": 88,
      "last_event_at": "2026-08-04T13:54:37Z"
    }
  ]
}
```

### `GET /api/hotspots/{h3}`

Детали ячейки по клику: топ статей и последние правки – требование из ТЗ
("клик по точке → статья и детали правки").

Query: `lang`, `include_bots`.

```json
{
  "h3": "861c1c97fffffff",
  "resolution": 6,
  "generated_at": "2026-08-04T13:54:37Z",
  "edits_count": 520,
  "users_count": 240,
  "top_pages": [
    {
      "title": "Eiffel Tower",
      "url": "https://en.wikipedia.org/wiki/Eiffel_Tower",
      "lang": "en",
      "edits_count": 142
    }
  ],
  "recent_edits": [
    {
      "edit_id": "enwiki|1234567890",
      "title": "Eiffel Tower",
      "url": "https://en.wikipedia.org/wiki/Eiffel_Tower",
      "lang": "en",
      "country_qid": "Q142",
      "place_type_qid": "Q570116",
      "type": "edit",
      "bot": false,
      "delta_len": 42,
      "user": "ExampleUser",
      "edited_at": "2026-08-04T13:54:37Z"
    }
  ]
}
```

`recent_edits` – не более 20 последних записей.

Если ячейка `h3` неактивна (в текущем окне нет правок) – `404`:

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "h3 cell 861c1c97fffffff has no activity in current window"
}
```

## 5. Дашборд

Строится поверх батч-витрин бэка (`T_MART_top_country`, `T_MART_top_wiki`,
`T_MART_edits_per_hour`) – обновляются раз в час.

### `GET /api/dashboard/summary`

Общие показатели за период.

Query: `window`.

```json
{
  "meta": { "window": "24h", "generated_at": "2026-08-04T13:54:37Z" },
  "data": {
    "total_edits": 50211,
    "top_country": { "country_qid": "Q30", "edits_count": 12000 },
    "top_wiki": { "wiki": "enwiki", "edits_count": 28000 }
  }
}
```

### `GET /api/dashboard/top-places`

Топ стран по числу правок – "место" здесь означает страну (`T_MART_top_country`
на бэке), не H3-ячейку.

Query: `window`, `limit`.

```json
{
  "meta": { "window": "24h", "generated_at": "2026-08-04T13:54:37Z" },
  "data": [
    { "country_qid": "Q30", "edits_count": 12000 },
    { "country_qid": "Q142", "edits_count": 8400 }
  ]
}
```

### `GET /api/dashboard/trends`

Временной ряд числа правок (`T_MART_edits_per_hour`).

Query: `window`.

```json
{
  "meta": { "window": "24h", "step": "1h", "generated_at": "2026-08-04T13:54:37Z" },
  "data": [
    { "bucket_start": "2026-08-04T12:00:00Z", "edits_count": 2103 }
  ]
}
```
