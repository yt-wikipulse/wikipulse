package com.springboot.web.wikipulseproject.model;

import java.time.Instant;

/**
 * Одна строка таблицы aggregates (по словесному описанию ментора).
 * ПРЕДВАРИТЕЛЬНАЯ: команда финализирует колонки — правим только тут и в source/.
 */
public record AggregateRow(
        String granularity,   // "hour" | "day" — за час или за день агрегат
        Instant bucketStart,  // к какому часу/дню относится
        String lang,          // null для глобальных строк ("WORLD")
        String h3,            // "WORLD" для глобальных строк, иначе ячейка
        long editsCount,      // число правок
        long usersCount,      // уникальных редакторов
        long pagesCount,      // уникальных статей
        long newArticles      // новых статей (type == new)
) {}
