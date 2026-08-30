# Фронтенд: устройство SPA

Браузерное приложение с двумя экранами: живая карта правок Википедии
(активные H3-ячейки, выбор ячейки, список статей) и дашборд исторической
аналитики. Данные берутся только из `/api/v1` — моков и вычислений
аналитики на клиенте нет.

Форматы ответов — в [../contracts/rest-api.md](../contracts/rest-api.md),
команды запуска и ключ Яндекс Карт — в
[frontend/README.md](../../frontend/README.md).

## Технологии

React, TypeScript, Vite, React Router, Яндекс Карты v3, `h3-js`,
SCSS Modules. SSR и server routes отсутствуют.

## Маршруты

```text
/             → redirect на /map
/map          → живая карта
/dashboard    → дашборд исторической аналитики
*             → страница «Не найдено»
```

Все страницы отображаются внутри общего `AppShell` с `Header`.
`DashboardPage` подгружается через `lazy`.

Используется `BrowserRouter`, поэтому production-сервер обязан возвращать
`index.html` при прямом открытии `/map`, `/dashboard` и неизвестного URL.
Vite dev server делает это сам, `pnpm preview` — нет.

## Структура

```text
frontend/src/
├── app/          # bootstrap, таблица маршрутов, AppShell, ErrorBoundary
├── pages/        # композиция маршрута и route-local state
├── features/     # orchestration: polling, cancellation, async state
├── components/   # UI и адаптеры внешних визуальных библиотек
├── api/          # HTTP, transport DTO, сериализация query
├── hooks/        # общие хуки
├── lib/          # общие чистые функции: форматирование, склонения
├── styles/       # tokens.css
├── assets/       # изображения
├── main.tsx      # BrowserRouter и React root
└── index.css     # глобальный CSS foundation
```

Ответственность папок:

- **`app/`** — только сборка приложения: маршруты, общий shell, layout.
  HTTP-запросов и feature-логики здесь нет;
- **`pages/`** — связывают маршрут, данные и крупные части интерфейса.
  Здесь живёт состояние, нужное нескольким соседним компонентам страницы
  (например, выбранный H3). Детали создания карты и сериализации query
  страница не знает;
- **`features/`** — orchestration сценария: поллинг, отмена, loading/error;
- **`components/`** — получают данные и callbacks через props, HTTP не
  делают. Исключение — `LiveMap`: он адаптер imperative API Яндекс Карт
  и владеет экземпляром карты, feature-объектами и их cleanup;
- **`api/`** — endpoint, сериализация query, transport-типы и граница
  HTTP-ошибок. О JSX и состоянии выбранной ячейки не знает.

## Поток данных карты

```text
Yandex Map viewport: bbox + zoom
    ↓
LiveMapPage: viewport + selectedH3
    ↓
useLiveMapData: debounce + polling + cancellation + loading/error
    ↓
api/hexagons.ts → backend
    ↓
ActiveHexagon[]
    ├──→ LiveMap: H3 → polygon → Yandex Map features
    └──→ CellPopover: выбранная ячейка и ссылки на статьи
```

UI использует поля `ActiveHexagon` напрямую, отдельной visual model нет.

Orchestration живой карты отвечает за получение viewport, debounce частых
перемещений карты, поллинг без наложения запросов, отмену при смене viewport
или unmount, защиту от устаревшего ответа, состояния `loading`, `refreshing`,
`error`, `empty`, `success` и сохранение последних хороших данных при
временной ошибке обновления.

## Владение состоянием

| Состояние | Владелец |
|---|---|
| React root, router | `main.tsx`, `app/` |
| Композиция маршрута | соответствующая page |
| Выбранный H3 | map page |
| Полученные ячейки и async state | feature orchestration |
| Экземпляр Яндекс Карт и features | refs внутри `LiveMap` |
| Выбранная ячейка целиком | вычисляется из cells + selected H3 |

Производные данные не хранятся вторым state, глобального store нет.

## Жизненный цикл карты

Яндекс Карты — внешняя imperative-система, поэтому компонент карты:

1. создаёт карту после готовности API и появления DOM-контейнера;
2. хранит map/features handles в `useRef`, а не в render state;
3. синхронизирует полигоны с props отдельным эффектом;
4. удаляет старые features при замене данных;
5. уничтожает карту и подписки при unmount.

Cleanup корректен под `StrictMode`.

## Дашборд

Маршрут `/dashboard` показывает исторические витрины из
`GET /api/v1/dashboard`. Периоды, шаг графика, поведение на пустых данных
и на ошибках описаны в контракте. Окно живой карты и витрины имеют разную
свежесть и разный смысл, поэтому аналитика из данных карты не считается.

## Стили

Три слоя:

- **глобальный foundation** — `index.css`: reset, `box-sizing`, подключение
  шрифта, базовые `html`/`body`/`#root`, общий `:focus-visible`. Компонентных
  классов в глобальном слое нет;
- **токены** — `styles/tokens.css`, подключается из `index.css`. Здесь живут
  semantic custom properties: роли цвета (`--color-text-primary`,
  `--color-background-surface`, `--color-border-default`, `--color-accent`,
  цвета диффа), шрифтовые стеки, шкала отступов `--space-*`, радиусы
  и `--focus-ring`. Значение выносится в токен, если выражает роль
  интерфейса, повторилось в двух компонентах или должно меняться
  согласованно;
- **компонентные стили** — `*.module.scss` рядом с владельцем.

Локальными остаются числа, не выражающие общей роли: размер логотипа или
точки, grid-шаблон конкретной страницы, ширина панели, геометрия карты.

В модуле один BEM-блок, названный по компоненту в `lowerCamelCase`; элементы
и модификаторы пишутся вложенно через `&__` и `&--`:

```scss
.header {
  &__brand {}
  &__tab {
    &--compact {}
  }
}
```

Состояния берутся из того, что уже есть в DOM: `:hover`, `:active`,
`:focus-visible`, `[aria-current="page"]`, `[aria-expanded]`. Отдельный
модификатор не добавляется там, где `aria-*` уже выражает то же состояние.

Два правила про состояния:

- у интерактивного элемента есть видимый `:focus-visible` — глобальный ring
  из `index.css` либо свой `box-shadow: var(--focus-ring)`;
- `:hover` у кнопок и ссылок обёрнут в `@media (hover: hover)`, потому что
  на тач-устройстве он залипает после тапа. Не обёрнут `:hover` столбцов
  графика в `DashboardPage.module.scss`: там он показывает тултип, и на
  тач-устройстве залипание тултипа выбранного столбца — нужное поведение.

Брейкпоинты проекта: `767px` — компактный layout (`COMPACT_LAYOUT`
в `hooks/useMediaQuery.ts`, он же в SCSS) и `1279px` — сокращённая ось
графика дашборда (`COMPACT_AXIS` в `DashboardPage.tsx`). Ещё две узкие
границы (`435px`, `600px`) живут локально в модулях, которым они нужны.
