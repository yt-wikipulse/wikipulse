# WikiPulse frontend

React SPA с живой картой правок Википедии.

## Локальный запуск

1. Установить зависимости:

   ```bash
   pnpm install
   ```

2. Создать `.env` на основе `.env.example` и указать ключ Яндекс.Карт.
   У бесплатного ключа лимит 100 загрузок карты в сутки:

   ```dotenv
   VITE_YMAPS_API_KEY=<KEY>
   ```

3. Запустить dev server:

   ```bash
   pnpm dev
   ```

Vite проксирует `/api` на `http://localhost:8080`, поэтому для HTTP-интеграции
backend должен быть доступен на этом адресе. Карта передаёт текущие `bbox` и
`zoom` в REST adapter и отображает ответ backend; локальные fixtures не
используются.

## Маршруты

- `/map` — живая карта;
- `/dashboard` — заглушка до появления исторического REST-контракта;
- `/` — redirect на `/map`;
- неизвестный URL — страница «Не найдено».

Production hosting для `BrowserRouter` должен возвращать `index.html` при
прямом открытии frontend-маршрута.

## Команды

| Команда | Назначение |
|---|---|
| `pnpm dev` | Vite dev server |
| `pnpm build` | TypeScript build и production bundle |
| `pnpm lint` | ESLint |
| `pnpm preview` | локальный preview production bundle |
| `pnpm test` | Vitest, один прогон |
| `pnpm test:watch` | Vitest в watch-режиме |

## Документация

- [Архитектура фронтенда](../docs/02-architecture/frontend.md)
- [Дорожная карта frontend MVP](../docs/01-product/roadmap.md)
- [REST-контракт](../docs/03-contracts/rest-api.md)
- [Правила написания стилей](../docs/02-architecture/frontend-styles.md)
- [Решения в коде фронтенда](../docs/02-architecture/frontend-implementation-notes.md)
- [Общий локальный запуск](../docs/05-runbooks/local-setup.md)
