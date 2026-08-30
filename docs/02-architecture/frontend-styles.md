# Frontend: правила написания стилей

## 1. Назначение

Этот документ определяет обязательный стиль CSS/SCSS для frontend WikiPulse.
Он нужен, чтобы разные люди писали компоненты одинаково, а визуальные решения
не превращались в набор локальных цветов, шрифтов и несвязанных классов.

Основной принцип:

```text
глобально — только foundation;
локально — только стили своего компонента;
повторяемое — через semantic tokens;
интерактивные состояния — явно;
```

Гайд применяется к новым компонентам и к файлам, которые существенно
изменяются.

## 2. Почему одного BEM мало

BEM решает только именование. Компонент, который лежит рядом со своим SCSS
Module и аккуратно назван, всё ещё может содержать:

- локальную палитру из повторяемых hex-цветов;
- собственное объявление `font-family`, отличающееся от глобального шрифта;
- component-specific значения без общего token foundation;
- hover без `@media (hover: hover)`;
- отсутствие `:focus-visible` у ссылок;
- круглую точку через `border-radius: 4.5px` вместо выражения намерения
  `border-radius: 50%`.

Поэтому правило звучит не как «используем BEM», а полностью:

> Используем component-owned SCSS Modules с одним BEM-блоком, semantic tokens
> и полной матрицей интерактивных состояний.

## 3. Слои стилей

### 3.1. Global foundation

Глобально разрешены только:

- reset и `box-sizing`;
- базовые `html`, `body`, `#root`;
- подключение шрифтов;
- semantic CSS custom properties;
- общие accessibility defaults, например базовый focus ring;
- browser-level layout, который действительно относится ко всему приложению.

Глобальный слой не должен содержать `.button`, `.header`, `.card`, `.title` и
другие component classes.

Целевая структура:

```text
frontend/src/
├── styles/
│   └── tokens.css            # runtime semantic custom properties
├── index.css                 # reset и document/root defaults
└── **/*.module.scss          # app/page/feature/component-owned styles
```

`tokens.css` подключается один раз из `index.css`. Компонентные modules читают
custom properties через `var(...)` и не импортируют палитру отдельно.

### 3.2. Page и layout

Page/layout module отвечает за композицию своих прямых областей:

- grid/flex раскладку;
- размеры основных панелей;
- прокрутку страницы;
- `min-width: 0` / `min-height: 0` у собственных grid/flex children.

Page не должен знать внутренние классы `Header`, `LiveMap` или другого
компонента.

### 3.3. Component

Компонент владеет:

- своим root block;
- своими element/modifier/state styles;
- локальной геометрией;
- интерактивными состояниями;
- локальным layout своего содержимого.

Компонент не должен переопределять внутренние DOM-классы дочернего компонента.
Если дочернему компоненту нужен вариант, добавляется typed prop/modifier либо
осмысленная CSS custom property в его публичном style contract.

## 4. CSS Modules и BEM

### 4.1. Один module — один основной block

Имя блока повторяет смысл компонента или страницы в `lowerCamelCase`:

```scss
.header {}
.liveMap {}
.liveMapPage {}
.notFoundPage {}
```

Запрещён набор независимых имён без видимого владельца:

```scss
// Не использовать.
.root {}
.brand {}
.dot {}
.tab {}
```

Причина: такие классы показывают только локальный DOM, но не выражают
принадлежность элемента и плохо читаются в TSX, review и DevTools.

### 4.2. Elements и modifiers

Elements и modifiers пишутся вложенно через SCSS:

```scss
.header {
  &__brand {}
  &__brandName {}
  &__nav {}
  &__tab {
    &--compact {}
  }
}
```

TSX использует полное имя:

```tsx
<header className={styles.header}>
  <div className={styles.header__brand}>
    <span className={styles.header__brandName}>WikiPulse</span>
  </div>
</header>
```

### 4.3. Глубина вложенности

Допустимая вложенность:

1. block;
2. element/modifier;
3. pseudo-class, `aria-*`, `data-*` или media state этого элемента.

Не строить CSS-копию DOM:

```scss
// Не использовать.
.card {
  section {
    aside {
      div {
        svg {}
      }
    }
  }
}
```

Нужные узлы получают явные BEM-классы. Селекторы по тегу допустимы только для
полностью контролируемого простого content subtree, когда отдельный class не
добавляет смысла.

### 4.4. Состояния

Использовать источник состояния, который уже существует в DOM:

- `:hover`, `:active`, `:focus-visible`, `:disabled`;
- `[aria-current="page"]`, `[aria-expanded="true"]`;
- `[data-state="loading"]` для состояния, не имеющего native/ARIA-селектора;
- `&--secondary` для визуального варианта компонента.

Не добавлять BEM modifier, если `aria-*` уже точно выражает тот же state.

## 5. Tokens

### 5.1. Semantic, а не palette-by-component

Компонент не должен объявлять собственные повторяемые цвета:

```scss
// Не использовать в обычном UI-компоненте.
color: #6b6862;
background: #fbe9dc;
border-color: #e7e4de;
```

Вместо этого используются semantic roles:

```css
:root {
  --color-background-page: #ffffff;
  --color-background-surface: #f7f6f3;
  --color-background-interactive-hover: #f2f0ec;
  --color-background-accent-soft: #fbe9dc;

  --color-text-primary: #1b1a18;
  --color-text-secondary: #6b6862;
  --color-text-accent: #a8450a;

  --color-border-default: #e7e4de;
  --color-accent: #e8620c;

  --font-family-sans: Inter, Arial, Helvetica, sans-serif;
  --font-family-brand: "Helvetica Neue", Helvetica, "Segoe UI", Arial,
    sans-serif;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 28px;

  --radius-small: 7px;
  --radius-medium: 12px;

  --focus-ring: 0 0 0 3px rgb(232 98 12 / 30%);
}
```

Названия выше показывают требуемую семантику. Точные значения и финальный
набор задаёт `frontend/src/styles/tokens.css`.

### 5.2. Что обязательно выносить

В token foundation выносятся значения, если выполняется хотя бы одно условие:

- значение повторилось в двух компонентах;
- значение выражает роль интерфейса: text, surface, border, accent, error;
- значение должно меняться согласованно;
- значение относится к общей typography, focus, shadow или z-index policy.

### 5.3. Что можно оставить локальным

Не нужно создавать token для каждого числа из макета. Локально допустимы:

- точный размер logo/dot/icon;
- component-specific grid template;
- уникальная ширина панели;
- geometry карты или data visualization;
- значение, которое не выражает общую роль и не повторяется.

Локальное число должно быть объяснимо назначением. Например, круг пишется как
`border-radius: 50%`, а не через половину текущей ширины в пикселях.

### 5.4. Шрифты

Font stack объявляется один раз через token. Компонент задаёт только нужные
`font-size`, `font-weight`, `line-height` и `letter-spacing`.

Если brand действительно использует другой шрифт, компонент читает
`var(--font-family-brand)`. Дублировать полный stack в каждом element нельзя.

## 6. Порядок declarations

Внутри selector свойства группируются в следующем порядке:

1. positioning и stacking;
2. display/layout и alignment;
3. dimensions и box model;
4. overflow;
5. typography;
6. border/background/shadow;
7. interaction: cursor, transition, pointer behavior;
8. вложенные states;
9. media rules.

Между смысловыми группами оставляется пустая строка:

```scss
.header {
  position: sticky;
  z-index: 10;
  top: 0;

  display: flex;
  align-items: center;
  gap: var(--space-7);

  min-width: 0;
  height: 57px;
  padding: 0 var(--space-5);

  color: var(--color-text-primary);
  background: var(--color-background-page);
  border-bottom: 1px solid var(--color-border-default);
}
```

Property ordering нужен для чтения и review, а не ради механической сортировки
по алфавиту.

## 7. Интерактивные состояния

У каждого интерактивного элемента проверяются:

- default;
- hover на устройстве с hover;
- active/pressed;
- keyboard `:focus-visible`;
- current/selected;
- disabled, если поддерживается;
- loading, если действие асинхронное;
- reduced motion, если есть animation/transition.

Обязательный pattern:

```scss
.header {
  &__tab {
    color: var(--color-text-secondary);
    text-decoration: none;
    border-radius: var(--radius-small);

    &:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
    }

    &[aria-current="page"] {
      color: var(--color-text-accent);
      background: var(--color-background-accent-soft);
    }

    @media (hover: hover) and (pointer: fine) {
      &:hover {
        color: var(--color-text-primary);
        background: var(--color-background-interactive-hover);
      }
    }
  }
}
```

Hover не может быть единственным способом увидеть действие или получить
информацию.

Если добавляется motion:

```scss
@media (prefers-reduced-motion: reduce) {
  transition: none;
  animation: none;
}
```

## 8. Полный пример `Header`

Это пример целевой формы. Значения tokens берутся из foundation, а не
объявляются в компоненте.

```scss
.header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-7);

  min-width: 0;
  height: 57px;
  padding: 0 var(--space-5);

  background: var(--color-background-page);
  border-bottom: 1px solid var(--color-border-default);

  &__brand {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: var(--space-2);
  }

  &__dot {
    width: 9px;
    height: 9px;

    background: var(--color-accent);
    border-radius: 50%;
  }

  &__brandName {
    color: var(--color-text-primary);
    font-family: var(--font-family-brand);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  &__nav {
    display: flex;
    min-width: 0;
    gap: var(--space-1);
  }

  &__tab {
    padding: 7px 13px;

    color: var(--color-text-secondary);
    font-size: 13px;
    line-height: 1.2;
    text-decoration: none;

    border-radius: var(--radius-small);

    &:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
    }

    &[aria-current="page"] {
      color: var(--color-text-accent);
      background: var(--color-background-accent-soft);
    }

    @media (hover: hover) and (pointer: fine) {
      &:hover {
        color: var(--color-text-primary);
        background: var(--color-background-interactive-hover);
      }
    }
  }

}
```

## 9. Запрещённые практики

- Несколько независимых top-level classes `.root`, `.item`, `.title` в одном
  component module вместо одного BEM-block.
- Hex/rgb palette literals в обычном UI после появления соответствующего
  semantic token.
- Полный `font-family` в каждом компоненте.
- `!important` как обычный способ переопределения.
- Стилизация internals дочернего компонента через глубокие selectors.
- Глобальный component CSS.
- DOM-shaped nesting глубже трёх уровней.
- Hover без hover capability guard.
- Удаление native focus outline без равноценного `:focus-visible`.
- JS-проверка ширины экрана только ради того, что решается CSS.
- Массовое создание tokens для каждого уникального значения из макета.
- Копирование SCSS, fonts, assets или breakpoint API из закрытых внутренних
  библиотек: в этом репозитории их нет и быть не может.

Исключения для карты/data visualization допускаются, когда цвет или geometry
вычисляются из данных. Они живут рядом с map feature и не становятся скрытой
палитрой обычного UI.

## 10. Review checklist

Новый или существенно изменённый style module принимается, если:

- [ ] module лежит рядом с владельцем;
- [ ] есть один основной BEM-block;
- [ ] element/modifier names выражают смысл, а не позицию в DOM;
- [ ] нет новых palette literals при существующем semantic token;
- [ ] нет дублированного global font stack;
- [ ] component не стилизует internals ребёнка;
- [ ] property groups читаются в принятом порядке;
- [ ] `min-width: 0` / `min-height: 0` добавлены там, где они нужны;
- [ ] hover ограничен capability query;
- [ ] есть видимый keyboard focus;
- [ ] current/selected/disabled state выражен семантически;
- [ ] контент не становится недостижимым из-за overflow;
- [ ] motion учитывает `prefers-reduced-motion`;
- [ ] исключение или уникальное число имеет понятную причину;
- [ ] не создана абстракция без повторяемого use-case.

## 11. Definition of Done для стилей

Стилевая часть frontend-задачи завершена, когда:

1. Компонент соответствует этому гайду.
2. Проверены default, focus, current/selected и доступные интерактивные states.
3. Hover проверен отдельно от touch.
4. Проверены целевые viewport'ы, а не только тот, что открыт у автора.
5. Изменение не вводит новый локальный token namespace.
6. Reviewer проверил module не только визуально, но и по checklist.
7. Если понадобилось новое общее правило, обновлён этот документ, а не только
   один component file.

## 12. Адаптивность

1. Breakpoint появляется потому, что контент перестал помещаться, а не потому,
   что это популярная ширина устройства.
2. Значение границы не изобретается заново в каждом module: одна и та же
   граница пишется одинаково везде, где она означает одно и то же.
3. Не копируется полная шкала другого продукта: остаются только реально
   используемые границы WikiPulse.
4. CSS меняет layout; React conditional render применяется только при реальном
   изменении interaction/accessibility tree.
5. Проверяются `min-width: 0`, `min-height: 0`, внутренний scroll, `100dvh`,
   safe-area и отсутствие недостижимого overflow.
6. Boundary проверяется на самой границе и с обеих сторон.

Layout не должен ломать основной сценарий или делать контент недостижимым ни
на одном из поддерживаемых viewport'ов.
