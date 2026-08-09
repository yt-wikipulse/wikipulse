# WikiPulse frontend: командный план

## 1. Цель

Собрать frontend WikiPulse так, чтобы:

- живая карта показывала свежие правки Википедии в правильных H3-ячейках;
- пользователь мог открыть статьи выбранной области;
- дашборд показывал хотя бы одну аналитику по истории правок;
- карта и дашборд имели заранее согласованные маршруты и общий application
  shell;
- два frontend-разработчика могли работать параллельно с минимальным числом
  конфликтов в общих файлах;
- каждый этап заканчивался работающим инкрементом, а не набором несвязанных
  заготовок.

## 2. Источники

- Продуктовое ТЗ: [`../00-brief/tz.md`](../00-brief/tz.md).
- REST-контракт в репозитории:
  [`../03-contracts/rest-api.md`](../03-contracts/rest-api.md).
- Архитектура frontend:
  [`frontend.md`](frontend.md).
- Командный процесс: [`../../process/workflow.md`](../../process/workflow.md) и
  [`../../process/roles.md`](../../process/roles.md).
- UI-макет:
  <https://www.figma.com/design/xNAs3bsVMUAkMP2Ji6fAdG/WikiPulse?node-id=0-1>.
- FigJam со схемой и API-блоками:
  <https://www.figma.com/board/T0QopYmqwWGhKA3BSZeVrO/WikiPulse-Schema?t=m87xsNlX5Gp0VUn1-0>.

FigJam повторно проверен через обычный браузер 2026-08-09. Доска и репозиторий
согласны по `bbox + zoom` и response shape карты, но пока расходятся по точному
path endpoint. После P0 должен остаться один source of truth.

## 3. Текущее состояние frontend

Стек:

- React 19;
- Vite 8;
- TypeScript;
- SCSS Modules;
- `h3-js`;
- Яндекс.Карты v3.

Сейчас отсутствуют query library, global state manager, form library,
Storybook и test runner. React Router уже добавлен.

Уже есть:

- `frontend/src/api/hexagons.ts` с typed DTO и сериализацией query;
- `frontend/src/components/LiveMap/LiveMap.tsx` с созданием и cleanup карты;
- два snapshot mock в `frontend/src/mocks/hotspots.ts`;
- выбор H3 и sidebar в `frontend/src/pages/LiveMapPage.tsx`;
- `BrowserRouter`, application shell, header, `/map`, `/dashboard`, Not Found
  и redirect `/` → `/map`;
- отдельные `app/`, `pages/` и route-local SCSS Modules;
- BEM-именование внутри компонентных SCSS Modules.

Routing появился в feature-коммите `61f20f0` и вошёл в `main` merge-коммитом
`1a3de88`. Page boundaries, shell и Not Found добавлены в foundation-коммите
`271a785` в ветке `chore/27-frontend-skeleton`.

Главные следующие задачи:

- API-функция не вызывается;
- экран продолжает использовать старые snapshot mocks;
- старый `Hotspot` содержит поля, которых нет в актуальных вариантах
  backend-контракта;
- backend-контроллер карты пока является contract mock и не доказывает работу
  с реальным кэшем и видимой областью;
- dashboard пока представлен только route stub;
- production hosting пока не подтверждает SPA fallback для прямого открытия
  `/map` и `/dashboard`.

Технические риски текущего состояния:

- `body { overflow: hidden }` вместе с высокой картой может сделать sidebar
  недоступным на коротком mobile viewport;
- `index.html` использует `lang="en"`, хотя интерфейс русский;
- TypeScript `strict` не включён;
- network JSON только приводится к типу и не проверяется runtime;
- нет автоматических тестов на API и state flow.

## 4. P0 — согласовать контракты

Большая часть map-контракта уже согласована. Открыты точный path, error contract
и будущий источник dashboard-данных.

### Вариант в репозитории

```http
GET /api/v1/hexagons/active
  ?min_lng=...
  &min_lat=...
  &max_lng=...
  &max_lat=...
  &zoom=...
```

Ответ содержит `hexagons[]` с `h3_index`, `events_count` и `events[]`.
Dashboard в `docs/03-contracts/rest-api.md` отложен до v2.

### Текущий вариант в FigJam

```http
GET /api/v1/hexagons
  ?min_lng=...
  &min_lat=...
  &max_lng=...
  &max_lat=...
  &zoom=...
```

```text
response_schema = {
  hexagons = array<{
    h3_index = string;
    events_count = int64;
    events = array<{
      id = string;
      title = string;
      url = string;
    }>;
  }>;
}
```

Таким образом, единственное path-расхождение карты сейчас:

- FigJam: `/api/v1/hexagons`;
- backend, frontend и `docs/03-contracts/rest-api.md`:
  `/api/v1/hexagons/active`.

```http
GET /api/dashboard?period=24h
```

```text
response_schema = {
  total_events = int64;
  top_articles = array<{
    title = string;
    url = string;
    events_count = int64;
  }>;
}
```

Query-параметры не нужно дублировать в response metadata.

### Решения P0 на 2026-08-09

| # | Вопрос | Решение / статус |
|---|---|---|
| 1 | Canonical path и versioning | **Открыто.** Выбрать `/api/v1/hexagons` или `/api/v1/hexagons/active`. |
| 2 | Параметры карты | **Решено:** frontend отправляет `bbox + zoom`. |
| 3 | Дробный zoom и диапазон | **Решено:** frontend использует `floor`; допустимый диапазон как у backend — `0…30`. |
| 4 | `events_count` | **Решено:** оставить, раз поле уже отдаёт backend. |
| 5 | Error contract | **Открыто.** Docs обещают Problem Details, но `BadRequestException` не размечен, а `GlobalExceptionHandler` пуст. |
| 6 | Dashboard сейчас | **Решено:** сегодня не реализовывать; route, nav и page stub заложить сейчас. |
| 7 | Источник `top_articles` | **В работе.** FigJam прямо отмечает, что `aggregates` не содержит `title`/`url`; нужен исторический источник или агрегат по статьям. |

Критерии завершения P0:

- обновлён один отслеживаемый REST-документ;
- обе стороны стыка B/F подтвердили контракт;
- FigJam и репозиторий не противоречат друг другу;
- frontend не добавляет поля, которых нет в выбранном контракте.

## 5. P0.5 — frontend foundation

Foundation реализован в ветке `chore/27-frontend-skeleton`. Базовые routing
changes уже находятся в `main` (`1a3de88`), а окончательное разделение shell,
routes и pages выполнено в `271a785`. До создания двух параллельных
feature-веток foundation нужно отревьюить и влить в `main`.

### Маршруты

- `/` — redirect на `/map`;
- `/map` — живая карта;
- `/dashboard` — дашборд или честная заглушка до готовности feature;
- `*` — Not Found.

Использовать React Router в Declarative Mode. Route loaders/actions сейчас не
нужны: запрос карты зависит от живого viewport и polling, поэтому orchestration
остаётся внутри feature-hook.

Для `BrowserRouter` production-сервер обязан возвращать `index.html` при прямом
запросе `/dashboard`. Если серверный SPA fallback нельзя настроить, решение о
другом режиме routing принимается в foundation, а не перед релизом.

### Целевая структура

```text
frontend/src/
├── app/
│   ├── App.tsx
│   ├── AppShell.tsx
│   ├── AppShell.module.scss
│   └── routes.tsx
├── pages/
│   ├── LiveMapPage.tsx
│   ├── DashboardPage.tsx
│   └── NotFoundPage.tsx
├── features/
│   ├── live-map/
│   └── dashboard/              # создавать при начале реальной feature
├── api/
├── main.tsx
└── index.css
```

Это feature-colocation, а не полный FSD. Не нужны `entities`, `widgets`,
`shared/types` и отдельные packages без реального второго use-case.

### Что уже сделано

- добавлен `react-router-dom` и обновлён lockfile;
- `BrowserRouter` подключён в `main.tsx`;
- добавлен header с навигацией «Карта / Дашборд»;
- `/` перенаправляет на `/map`;
- `/map` показывает существующий map spike через отдельный `LiveMapPage`;
- `/dashboard` показывает отдельную честную заглушку;
- `*` показывает `NotFoundPage`;
- route table вынесена в `app/routes.tsx`, общий layout — в `AppShell`;
- `App.tsx` остался тонкой точкой сборки и больше не содержит feature markup;
- компонентные стили используют один BEM-блок и `&__element` / `&--modifier`;
- `pnpm --dir frontend lint` и `pnpm --dir frontend build` проходят
  2026-08-09.

### Осталось до merge foundation

1. Закоммитить BEM-приведение и этот documentation update поверх `271a785`.
2. Проверить мышью и клавиатурой `/`, `/map`, `/dashboard` и неизвестный URL.
3. Проверить direct reload `/map` и `/dashboard` на том production-like
   сервере, который будет использовать команда. Успешный Vite build сам по
   себе не доказывает наличие SPA fallback у внешнего сервера.
4. Провести review границ `app/`, `pages/` и будущих feature-зон.
5. Влить foundation в `main`; только после этого создавать две параллельные
   feature-ветки.

Hover header без `@media (hover: hover)` и дальнейший mobile polish относятся к
P2, а не блокируют завершение foundation.

### Входит в foundation

- dependency и bootstrap router;
- общий application shell и навигация «Карта / Дашборд»;
- route table со всеми согласованными маршрутами;
- механический перенос текущего map spike за `LiveMapPage` без изменения
  поведения;
- `DashboardPage` без выдуманных API-данных;
- `NotFoundPage`;
- route-local styles и минимальная responsive-композиция shell;
- документация архитектурного решения.

### Не входит в foundation

- подключение реального API;
- polling, debounce и abort;
- изменение DTO;
- dashboard mocks и графики;
- global store или query library;
- универсальные UI-компоненты;
- массовый CSS-редизайн;
- удаление старых mocks до переключения их потребителей.

### Приёмка foundation

| Критерий | Статус на 2026-08-09 |
|---|---|
| `/` перенаправляет на `/map` | Реализовано |
| `/map` показывает существующий map spike | Реализовано |
| `/dashboard` показывает отдельную страницу в общем shell | Реализовано |
| неизвестный URL показывает 404 | Реализовано |
| навигация имеет active state | Реализовано; нужна ручная keyboard-проверка |
| direct reload работает на production-like hosting | Открыто |
| `build` и `lint` проходят | Подтверждено локально |
| foundation не вводит новый backend contract | Подтверждено |
| feature-код отделён от общих entry-файлов | Реализовано |

## 6. Разделение работы двух frontend-разработчиков

### До merge foundation

| Зона | Владелец | Правило |
|---|---|---|
| `package.json`, lockfile, `main.tsx`, `app/**`, page stubs, global CSS | один foundation-разработчик | второй не создаёт параллельную frontend-ветку |
| Review foundation | второй frontend-разработчик | проверяет route boundaries и будущие зоны владения |

### После merge foundation

| Зона | Разработчик 1 | Разработчик 2 |
|---|---|---|
| Map data/orchestration | API adapter, query params, polling, abort, stale-response protection, viewport flow | review |
| Map presentation | review | polygons, selection, sidebar/list, SCSS, UI states, responsive, accessibility |
| Integration | владеет `LiveMapPage.tsx` | поставляет presentational components через согласованные props |
| Dashboard после готовности контракта | review | `features/dashboard/**` и `DashboardPage.tsx` |

Перед расхождением feature-веток нужно согласовать только маленькую публичную
границу map-компонентов:

- массив доменных ячеек/событий;
- выбранный H3;
- `onSelect`;
- `onViewportChange`, если его требует выбранный контракт;
- loading/refreshing/error/empty state;
- `onRetry`.

Правила снижения конфликтов:

- у `LiveMapPage.tsx` один владелец-интегратор;
- router и shell меняет только foundation owner отдельным маленьким PR;
- feature styles лежат рядом с feature;
- не создавать общий barrel `index.ts`, который оба постоянно редактируют;
- dependency/lockfile changes не смешивать с feature PR;
- обе ветки создаются только от `main`, содержащего foundation;
- ветка живёт 1–2 дня, затем merge/rebase, review и удаление.

## 7. Архитектурные границы

### API

- Transport-функция знает HTTP, query serialization и точный DTO.
- Network JSON считается недоверенным.
- Общий `requestJson` появляется, когда действительно повторились error/parser
  правила.
- UI не додумывает отсутствующие backend fields.
- DTO и UI model разделяются только при реальном преобразовании.

### Orchestration

- Feature-hook владеет загрузкой, polling, cancellation и async state.
- Рекурсивный `setTimeout` предпочтительнее накладывающихся `setInterval`
  запросов.
- Новый viewport отменяет старый запрос или делает его результат неактуальным.
- Background refresh сохраняет последние хорошие данные.
- Debounce viewport events и polling данных — разные механизмы.

### Presentational components

- `LiveMap` знает только imperative map rendering, геометрию и viewport events.
- Sidebar/list показывает выбор и события, но не делает fetch.
- Props описываются рядом с компонентом.
- Компонент не становится «универсальным» до второго use-case.
- `useMemo` и `useCallback` добавляются по identity/performance trigger, а не
  автоматически.

### State ownership

| State | Владелец |
|---|---|
| Yandex map/features instances | refs внутри `LiveMap` |
| bbox/zoom | map screen / viewport adapter |
| cells/loading/error | feature fetch hook |
| `selectedH3` | `LiveMapPage` |
| выбранная ячейка целиком | derived в render |
| mobile sidebar open/closed | локальный UI state |
| dashboard period | `DashboardPage` или dashboard feature |

Global store пока не нужен.

## 8. P1 — вертикальный срез живой карты

После выбора контракта:

1. Получить `bbox + zoom` из map lifecycle.
2. Нормализовать zoom через `Math.floor`, проверить диапазон `0…30` и не
   делать скрытый clamp.
3. После решения P0.1 зафиксировать canonical path в API-функции и docs.
4. Подключить typed API-функцию.
5. Добавить polling 2–3 секунды без наложения запросов.
6. Добавить abort и stale-response protection.
7. Добавить debounce viewport events 150–300 ms.
8. Передавать server response в `LiveMap` и sidebar через согласованные props.
9. Заменить старые поля sidebar на поля выбранного контракта.
10. Удалить старые `Hotspot`/snapshot mocks после перехода всех потребителей.

Приёмка:

- fake/backend contract response проходит полный путь до polygons и списка;
- изменение viewport/резолюции создаёт корректный новый запрос;
- устаревший response не перезаписывает новые данные;
- внешний link ведёт на статью;
- пустой массив является нормальным empty state;
- map lifecycle корректен под React `StrictMode`.

## 9. P2 — UX и устойчивость карты

Обязательная матрица состояний:

| Состояние | Ожидаемое поведение |
|---|---|
| map script loading | стабильный shell и progress |
| initial API loading | loading без layout jump |
| success with cells | polygons и список событий |
| success empty | понятный empty state |
| background refresh | старые данные остаются, refresh ненавязчив |
| error without data | error и Retry |
| error with stale data | старые данные и предупреждение |
| selected cell disappears | выбор сброшен или явно помечен устаревшим |
| mobile | карта и sidebar достижимы скроллом |
| keyboard | список ячеек и статей доступен без клика по canvas |

Accessibility minimum:

- выбор H3 в альтернативном списке — нативные `button`;
- статьи — нативные `a` с понятным именем;
- loading/refresh — `aria-busy`, при необходимости `role="status"`;
- ошибка видима и содержит Retry;
- selected state выражен семантически;
- focus не теряется после polling update;
- `lang="ru"` для русского интерфейса;
- `:focus-visible` обязателен;
- hover не является единственным способом взаимодействия.

Responsive minimum:

- SCSS Modules сохраняются;
- `min-width: 0` / `min-height: 0` у flex/grid children;
- fullscreen layout использует `100dvh` с разумным fallback;
- hover-стили ограничены `@media (hover: hover)`;
- mobile layout не запирается недостижимым `overflow: hidden`;
- safe-area учитывается там, где control упирается в край экрана.

## 10. P3 — вертикальный срез дашборда

Начинать после подтверждения backend-контракта и источника исторических
`title`/`url`.

1. Создать typed dashboard API adapter.
2. Реализовать period selection только для поддержанных backend-значений.
3. Показать `total_events`.
4. Показать `top_articles` с title, link и events count.
5. Добавить loading/error/empty/retry.
6. Проверить прямое открытие и reload `/dashboard`.
7. Не добавлять chart library, если аналитика читаемо показывается без графика.

Приёмка:

- данные приходят из исторического backend-источника, а не frontend mock;
- period меняет запрос и результат;
- неизвестные поля не вычисляются на frontend;
- dashboard работает независимо от mount/unmount карты.

## 11. P4 — качество и интеграция

### Минимальные тесты

1. Query serialization выбранного map-контракта.
2. Не-2xx response превращается в видимую ошибку.
3. Success показывает H3 и ссылки на события.
4. Empty response показывает empty state.
5. Новый viewport/параметр отменяет или инвалидирует старый request.
6. Dashboard period сериализуется корректно.
7. Router открывает `/`, `/dashboard` и Not Found.

### TypeScript и lint

- включить `strict` отдельным узким изменением после первого рабочего среза;
- при наличии времени включить type-aware ESLint;
- не закрывать ошибки broad `any` и assertions;
- build, lint и test должны быть отдельными видимыми gates.

### Integration

- проверить приложение из чистого clone;
- проверить production-like build/preview;
- проверить direct-route reload;
- проверить связку browser → frontend `/api` → backend;
- прогнать основной demo flow карты и дашборда;
- обновить README и сценарий защиты.

## 12. Зависимости и trigger'ы

| Инструмент | Решение сейчас | Когда пересмотреть |
|---|---|---|
| React Router | уже добавлен в foundation | пересмотреть только режим production hosting |
| TanStack Query/SWR | не добавлять | несколько features делят cache или появляются mutations/invalidation |
| Zustand/Redux | не добавлять | один client workflow нужен далёким веткам дерева |
| React Context | не добавлять | theme/toast/session/config имеют несколько consumers |
| Zod | не добавлять автоматически | нестабильные production DTO или несколько внешних контрактов |
| Storybook | не добавлять | появился повторно используемый набор primitives и visual workflow |
| UI package | не создавать | несколько независимых приложений делят versioned UI |
| Chart library | не добавлять заранее | выбранная аналитика действительно требует графика |

## 13. Общий Definition of Done для frontend-задачи

- изменение находится в `main`;
- PR отревьюен не автором;
- build, lint и релевантные тесты зелёные;
- route и responsive-поведение проверены вручную;
- loading/error/empty/success состояния не скрыты;
- API DTO совпадает с утверждённым контрактом;
- frontend не маскирует backend/pipeline проблему выдуманным fallback;
- shared files не содержат случайных feature-решений;
- если изменён контракт — обновлены docs и уведомлена backend-сторона;
- ветка короткоживущая и не содержит несвязанных dependency/formatting changes.

## 14. Порядок старта

1. Ветка `chore/27-frontend-skeleton` содержит foundation-коммит `271a785`;
   локальные BEM/docs changes нужно оформить отдельным небольшим коммитом.
2. Выполнить ручную route-проверку и проверить SPA fallback на выбранном
   production-like hosting.
3. Отдать foundation на review и влить его в `main`.
4. Решить P0.1: `/api/v1/hexagons` или `/api/v1/hexagons/active`.
5. Зафиксировать решения P0.2–P0.4 и P0.6 в REST/docs.
6. Оставить вопросы P0 №5 и №7 явно открытыми, не выдумывая frontend fallback.
7. Согласовать публичные props map-компонентов и назначить одного владельца
   `LiveMapPage.tsx`.
8. Только после merge foundation создать две feature-ветки от обновлённого
   `main`.
9. Параллельно выполнить map orchestration и map presentation.
10. Свести обе части через владельца `LiveMapPage.tsx`.
11. Закрыть UX/state matrix карты.
12. После готовности historical backend contract реализовать dashboard.
13. Провести quality/integration этап и feature freeze.
