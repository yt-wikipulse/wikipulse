# Локальный запуск

WikiPulse на своей машине без кластера YTsaurus: бэкенд на профиле `mock`,
фронтенд из dev-сервера Vite.

Нужен настоящий пайплайн — [local-cluster.md](local-cluster.md). Все
переменные окружения — [configuration.md](configuration.md). Что делать,
когда сломалось, — [troubleshooting.md](troubleshooting.md).

## Что нужно поставить

| Инструмент | Версия | Зачем |
|---|---|---|
| JDK | 17 | `java.version` в `backend/pom.xml` |
| Node.js | `^20.19` или `>=22.12` | требование Vite 8 |
| pnpm | ставится сам | версия закреплена полем `packageManager` в `frontend/package.json` |
| Ключ Яндекс.Карт API v3 | — | без него карта не отрисуется |

## 1. Бэкенд

```bash
cd backend
SPRING_PROFILES_ACTIVE=mock YMAPS_API_KEY=<ключ> ./mvnw spring-boot:run
```

Поднимается на `http://localhost:8080`.

- **`SPRING_PROFILES_ACTIVE=mock` обязателен.** Профиль по умолчанию — `yt`
  (`spring.profiles.default`), а он ходит в кластер по RPC.
- **Больше ничего задавать не нужно.** `YT_PROXY` и `YT_TOKEN` читают только
  бины с `@Profile("yt")`; на `mock` они не создаются.
- **`YMAPS_API_KEY` нужен, чтобы отрисовалась карта.** Где взять ключ — в
  [frontend/README.md](../../frontend/README.md). Без ключа бэкенд поднимется
  и данные отдаст, `GET /api/v1/config` вернёт пустую строку, а карта покажет
  экран ошибки.

Проверить, что бэкенд отвечает:

```bash
curl -s "http://localhost:8080/api/v1/hexagons/active?min_lng=37.31&min_lat=55.57&max_lng=37.85&max_lat=55.91&zoom=10"
curl -s "http://localhost:8080/api/v1/dashboard?period=24h&limit=5"
```

Первый запрос отдаёт непустой ответ сразу после старта: `MockPoller` заливает
в кэш всю выборку в `@PostConstruct`. Пустой `hexagons` в конкретном
прямоугольнике — нормальный ответ: в него не попала ни одна ячейка выборки.

## 2. Фронтенд

```bash
cd frontend
pnpm install
pnpm dev
```

Открыть `http://localhost:5173/map`.

Dev server проксирует `/api` на `http://localhost:8080`, поэтому бэкенд должен
быть уже поднят. **`pnpm preview` прокси не настраивает** — в `vite.config.ts`
он объявлен только для `server`, — так что сквозная проверка «браузер → `/api`
→ бэкенд» возможна только на `pnpm dev`.

Требование к хостингу одно: `BrowserRouter` требует отдавать `index.html` на
любой неизвестный путь, иначе прямое открытие `/map` вернёт 404.

## Что даёт профиль `mock`

Обе страницы работают на настоящих данных из фикстур
`backend/src/main/resources/fixtures/`: живая карта крутит по кругу снимок
правок Википедии, дашборд отдаёт три снятые витрины. Живого потока нет,
числа дашборда не меняются, а привязка правки к ячейке синтетическая —
подробнее в [backend.md](../architecture/backend.md).

Команды проверок перед ревью — в [CONTRIBUTING.md](../../CONTRIBUTING.md).
