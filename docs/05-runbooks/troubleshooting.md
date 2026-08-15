# Что делать, когда сломалось

Копилка граблей. Потратил на проблему больше получаса — запиши сюда, даже если
причина оказалась глупой: следующий человек потратит те же полчаса.

Формат записи: симптом (по возможности дословный текст ошибки), причина,
что делать. Порядок запуска — в [local-setup.md](local-setup.md).

## Бэкенд

### `BUILD FAILURE` на `testCompile`, `EnrichedEvent cannot be applied to given types`

```
InMemoryRecentEventsCacheTest.java:[130,16] constructor EnrichedEvent
in record ... cannot be applied to given types;
required: long,java.lang.String,...,long
found:    java.lang.String,java.lang.String,...
```

Тест отстал от текущей сигнатуры record `EnrichedEvent`: в main-коде шесть
полей, в тесте четыре. Падает любой `./mvnw`, который компилирует тесты, в том
числе обычный `spring-boot:run`.

Обход — `-Dmaven.test.skip=true`. Настоящее исправление на треке B: привести
тест к актуальной сигнатуре. После этого обход убрать из инструкций.

### `Could not resolve placeholder 'YT_PROXY'` при старте

`QEnrichedRepository` помечен `@Repository` без ограничения по профилю,
поэтому Spring создаёт его и на профиле `mock` и требует переменные окружения.

Задать заглушки: `YT_PROXY=localhost YT_TOKEN=dummy`. На `mock` значения
никуда не уходят.

### Порт 8080 занят

```bash
lsof -iTCP:8080 -sTCP:LISTEN -n -P
```

Обычно это предыдущий, не до конца остановленный `spring-boot:run`.

## Фронтенд

### `error TS2307: Cannot find module 'react-router-dom'`

Сборка падает на `tsc -b`, хотя зависимость есть в `package.json` и в
lock-файле. Причина — устаревший локальный `node_modules` (например, ветку
переключили, а установку не повторили).

```bash
cd frontend && pnpm install
```

### На `/map` вместо данных ошибка загрузки ячеек

`Failed to load active hexagons: 502` (или другой код) означает, что запрос до
бэкенда не дошёл. Две частые причины:

- бэкенд не поднят — проверить `curl` из [local-setup.md](local-setup.md);
- открыт `pnpm preview` вместо `pnpm dev`. В `vite.config.ts` прокси `/api`
  объявлен только для `server`, поэтому в preview запросы уходят в никуда.

### Карта не отрисовывается, вместо неё пустой прямоугольник

Не задан `VITE_YMAPS_API_KEY`: нет `.env` или в нём осталась заглушка из
`.env.example`. Ключ подставляется в тег скрипта Яндекс.Карт в `index.html`,
поэтому после правки `.env` dev server стоит перезапустить.

### `pnpm build` предупреждает про переменную окружения

Предупреждение про неподставленный `%VITE_YMAPS_API_KEY%` означает то же
самое: сборка прошла, но карта в этом бандле работать не будет.
