# Контракт: REST API

> Карта использует H3-ячейки. Клиент явно запрашивает одну из поддерживаемых
> резолюций: 3, 6 или 9.

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
| `resolution` | `3 \| 6 \| 9` | `6` | только у `/api/hotspots` |

`resolution` обязателен в запросе карты. Значение определяет резолюцию всех
H3-ячеек в ответе. Другие значения возвращают `400 Bad Request`.

## 3. Общие модели

### Hotspot

Агрегат активности внутри H3-ячейки за живое окно (60 сек – столько хранит
`RecentEditsCache` на бэке).

| Поле | Тип | Описание |
|---|---|---|
| `h3` | string | индекс H3-ячейки |
| `resolution` | `3 \| 6 \| 9` | резолюция H3-ячейки; совпадает с query-параметром запроса |
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
| `country_code` | string \| null | ISO 3166-1 alpha-2 код страны места, например `FR` |
| `place_type` | `city` \| `landmark` \| `mountain` \| `river` \| `other` \| null | нормализованная продуктовая категория места |
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
Клиент явно выбирает одну резолюцию для каждого запроса.

Query: `resolution` (обязателен), `lang`, `include_bots`.

Пример: `GET /api/hotspots?resolution=6`.

`meta.resolution`, `data[*].resolution` и фактическая резолюция каждого
`data[*].h3` должны совпадать со значением query-параметра `resolution`.

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

Для неподдерживаемой резолюции бэкенд возвращает `400`:

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "resolution must be one of 3, 6, 9"
}
```

### `GET /api/hotspots/{h3}`

Детали ячейки по клику: топ статей и последние правки – требование из ТЗ
("клик по точке → статья и детали правки").

Query: `lang`, `include_bots`.

Отдельный query-параметр `resolution` не нужен: его можно однозначно получить
из H3 index в path.

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
      "country_code": "FR",
      "place_type": "landmark",
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
`T_MART_edits_per_hour`) – обновляются раз в час. Витрина может хранить
Wikidata QID, но frontend получает нормализованный `country_code`.

### `GET /api/dashboard/summary`

Общие показатели за период.

Query: `window`.

```json
{
  "meta": { "window": "24h", "generated_at": "2026-08-04T13:54:37Z" },
  "data": {
    "total_edits": 50211,
    "top_country": { "country_code": "US", "edits_count": 12000 },
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
    { "country_code": "US", "edits_count": 12000 },
    { "country_code": "FR", "edits_count": 8400 }
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
