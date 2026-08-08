package com.springboot.web.wikipulseproject.model;

import java.time.Instant;

/**
 * Одна строка ЕДИНСТВЕННОЙ витрины aggregates.
 * ПРЕДВАРИТЕЛЬНАЯ схема по словам ментора: гранулярность + время + измерения + метрики.
 * Команда финализирует колонки — правим ТОЛЬКО этот файл и маппинг в source/.
 */
public record AggregateRow(
    String granularity,
    Instant bucketStart,
    String wiki,
    String countryQid,
    long editsCount
) {}
