# Архитектура фронтенда

## Задача фронтенда

WikiPulse — браузерное приложение с живой картой правок Википедии. Пользователь
видит активные H3-ячейки, выбирает область и открывает статьи, которые менялись
в ней.

Итоговое ТЗ также требует дашборд с исторической аналитикой. Текущий REST MVP
v1 ограничен живой картой; маршрут дашборда существует как честная заглушка и
не должен показывать выдуманные данные до появления исторического контракта.

## Источники истины

| Вопрос | Документ |
|---|---|
| Что должен уметь продукт | [ТЗ](../00-brief/tz.md) |
| В каком порядке собираем MVP | [Дорожная карта](../01-product/roadmap.md) |
| Какие данные отдаёт backend | [REST-контракт](../03-contracts/rest-api.md) |
| Как устроен frontend | Этот документ |
| Как писать стили | [Frontend styles](frontend-styles.md) |
| Кто владеет стыком и как менять контракт | [Роли](../../process/roles.md) |
| Как вести ветки, review и документацию | [Process](../../process/README.md) |

## Технологии

- React и TypeScript;
- Vite;
- React Router;
- Яндекс.Карты v3;
- `h3-js`;
- SCSS Modules.

Frontend — обычное SPA. SSR и server routes на стороне frontend отсутствуют.

## Маршруты

```text
/             → redirect на /map
/map          → живая карта
/dashboard    → заглушка до появления API исторической аналитики
*             → страница «Не найдено»
```

Все страницы отображаются внутри общего `AppShell` с `Header`.

Используется `BrowserRouter`, поэтому production-сервер должен возвращать
`index.html` при прямом открытии `/map`, `/dashboard` и неизвестного frontend
URL. Vite dev server делает это локально, но не подтверждает настройку внешнего
hosting.

## Структура и ответственность

```text
frontend/src/
├── app/          # bootstrap приложения, routes и общий shell
├── pages/        # композиция конкретного маршрута и route-local state
├── components/   # UI и адаптеры внешних визуальных библиотек
├── api/          # HTTP, transport DTO и сериализация query
├── mocks/        # временные development fixtures
├── types/        # существующие прикладные типы
├── main.tsx      # BrowserRouter и React root
└── index.css     # глобальный CSS foundation
```

### `app/`

Содержит только сборку приложения:

- таблицу маршрутов;
- общий shell;
- layout, общий для нескольких страниц.

Feature logic и HTTP-запросы в `app/` не размещаются.

### `pages/`

Page связывает route, данные и крупные части интерфейса. Здесь находится
состояние, которое нужно нескольким соседним компонентам страницы, например
выбранный H3.

Page не должна знать детали создания экземпляра Яндекс.Карт или сериализации
HTTP query.

### `components/`

Компоненты получают данные и callbacks через props. Обычный UI-компонент не
делает HTTP-запросов.

`LiveMap` является адаптером imperative API Яндекс.Карт, поэтому дополнительно
владеет экземпляром карты, feature-объектами и их cleanup.

### `api/`

API-модуль знает:

- endpoint;
- query serialization;
- transport request/response types;
- HTTP error boundary.

API-модуль не знает JSX, состояние выбранной ячейки и визуальное представление
данных.

### Асинхронный код

Promise-based операции во frontend пишутся через `async` / `await` и
`try` / `catch`. Цепочки `.then()` / `.catch()` не используются: единый стиль
проще читать и поддерживать.

Callback самого `useEffect` не объявляется `async`, потому что effect должен
синхронно вернуть cleanup или `undefined`. Асинхронная функция объявляется
внутри effect и запускается через `void`; cleanup отменяет внешний ресурс.

Это правило не относится к событийным callbacks (`onClick`, callback props,
listeners Яндекс.Карт): они являются контрактом соответствующего API, а не
способом обработки Promise.

### `features/`

Отдельная feature-папка появляется, когда у сценария возникает собственная
orchestration: polling, cancellation, loading/error state или несколько
связанных UI-компонентов. Создавать полный FSD-каркас заранее не нужно.

## Текущий поток данных карты

Карта получает данные из текущего backend endpoint через REST adapter:

```text
Yandex Map viewport: bbox + zoom
    ↓
LiveMapPage: viewport + selectedH3
    ↓
useLiveMapData: request + cancellation + loading/error
    ↓
api/hexagons.ts → backend
    ↓
ActiveHexagon[]
    ├──→ LiveMap: H3 → polygon → Yandex Map features
    └──→ sidebar выбранной ячейки и ссылки на статьи
```

Frontend fixtures удалены. Текущий UI использует только поля утверждённого
`ActiveHexagon`, поэтому отдельная visual model пока не нужна. Явный mapper
добавляется только если форма или ответственность UI-модели действительно
разойдётся с transport DTO.

Текущий срез делает запрос после получения нового viewport и отменяет
предыдущий при следующем изменении или unmount. Polling и отдельный debounce
добавляются следующим этапом.

## Целевой поток MVP v1

```text
Yandex Map viewport: bbox + zoom
    ↓
feature orchestration: debounce + request + polling + cancellation
    ↓
api/hexagons.ts
    ↓
REST API
    ↓
ячейки и события
    ├──→ LiveMap: polygons
    └──→ sidebar: выбранная ячейка и ссылки на статьи
```

Точный endpoint, query и response shape не повторяются здесь. Они определены в
[REST-контракте](../03-contracts/rest-api.md). Если contract, backend, frontend
adapter или внешняя схема расходятся, стороны B и F1 сначала согласуют стык, а
не маскируют расхождение в UI.

## Владение состоянием

| Состояние | Владелец |
|---|---|
| React root, router | `main.tsx`, `app/` |
| Route composition | соответствующая page |
| Выбранный H3 | map page |
| Полученные ячейки и async state | feature orchestration |
| Экземпляр Яндекс.Карт и features | refs внутри `LiveMap` |
| Выбранная ячейка целиком | вычисляется из cells + selected H3 |

Derived data не хранится вторым state. Глобальный store не нужен, пока одно
client state не используется несколькими независимыми ветками интерфейса.

## Lifecycle карты

Яндекс.Карты — внешняя imperative система. React-компонент карты должен:

1. Создать карту после готовности API и наличия DOM-container.
2. Хранить map/features handles в `useRef`, а не в render state.
3. Синхронизировать polygons с props отдельным effect.
4. Удалять старые features при замене данных.
5. Уничтожать карту и подписки при unmount.

Cleanup должен быть корректен под development-проверкой React `StrictMode`.

## Загрузка живых данных

Orchestration живой карты отвечает за:

- получение viewport;
- debounce частых событий перемещения карты;
- polling без наложения запросов;
- отмену запроса при смене viewport или unmount;
- защиту от устаревшего ответа;
- `loading`, `refreshing`, `error`, `empty` и `success`;
- сохранение последних хороших данных при временной ошибке refresh.

`LiveMap` и sidebar получают уже подготовленные данные и не владеют HTTP
lifecycle.

## Дашборд

Маршрут `/dashboard` зарезервирован, потому что аналитика входит в итоговое ТЗ.
В REST MVP v1 dashboard отложен, а источник исторических статей ещё не является
утверждённой границей между B и F1.

До появления контракта допустима только заглушка. Нельзя добавлять frontend
mocks, графики или вычислять историческую аналитику из данных живого окна так,
как будто это production dashboard.

## Зависимости

Новая инфраструктурная библиотека появляется по фактической потребности:

- query library — когда несколько сценариев разделяют server cache или нужны
  mutations/invalidation;
- global store — когда одно client state требуется независимым веткам UI;
- chart library — когда выбранную аналитику нельзя ясно показать без графика;
- UI-kit или Storybook — когда появился набор действительно переиспользуемых
  компонентов и отдельный visual workflow.

Для одного приложения отдельный UI-package не создаётся.

## Стили и доступность

Обязательные правила SCSS Modules, BEM, tokens и интерактивных состояний
находятся в [frontend-styles.md](frontend-styles.md).

Адаптивность следует приоритету, описанному в style guide: сначала рабочий
desktop MVP, затем отдельный этап responsive polish.

## Дизайн

Макет: <https://www.figma.com/design/xNAs3bsVMUAkMP2Ji6fAdG/WikiPulse?node-id=0-1>.

Макет определяет внешний вид и композицию, но не заменяет REST-контракт и
архитектурные границы.

## Проверка изменений

Команды frontend перечислены в [`frontend/README.md`](../../frontend/README.md).
Общий командный Definition of Done находится в
[`process/workflow.md`](../../process/workflow.md). Актуальный набор проверок
выбирается по затронутому коду; непроведённая browser или production-проверка
не объявляется выполненной.
