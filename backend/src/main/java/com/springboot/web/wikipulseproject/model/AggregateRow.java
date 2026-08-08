package com.springboot.web.wikipulseproject.model;

import java.time.Instant;

public record AggregateRow(
    String granularity,
    Instant bucketStart,
    String wiki,
    String countryCode,
    long editsCount
) {}
