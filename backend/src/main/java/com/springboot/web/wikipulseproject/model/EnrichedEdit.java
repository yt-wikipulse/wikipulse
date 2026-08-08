package com.springboot.web.wikipulseproject.model;

import java.time.Instant;

/**
 * Одна обогащённая правка — Java-представление строки очереди Q_ENRICHED
 * Поля повторяют схему из contracts.md + url на будущее
 */
public record EnrichedEdit(
        String eventId,      // "{wiki}|{rev_new}" — ключ и дедупликация
        String wiki,         // enwiki | ruwiki | ...
        String lang,         // en | ru | ...
        String title,        // нормализованный заголовок (с пробелами)
        String type,         // edit | new
        String user,         // логин редактора (может быть null у анонимов)
        boolean bot,         // правка от бота
        long deltaLen,       // length_new - length_old, байт
        Instant eventTs,     // время правки (event_ts из YT)
        boolean hasGeo,      // нашлись ли координаты
        Double lat,          // null, если !hasGeo (поэтому Double, а не double)
        Double lon,
        String placeType,    // city | landmark | ... (может быть null)
        String country,      // ISO-код страны (может быть null)
        String h3R6,         // H3-ячейка уровня города
        String h3R9,         // H3-ячейка уровня квартала
        String url           // СЕЙЧАС null (колонки нет); в будущем придёт из YT
) {}
