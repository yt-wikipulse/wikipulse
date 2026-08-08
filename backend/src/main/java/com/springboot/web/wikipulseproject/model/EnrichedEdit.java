package com.springboot.web.wikipulseproject.model;

import java.time.Instant;

public record EnrichedEdit(
    String eventId,
    String wiki,
    String lang,
    String title,
    String type,
    String user,
    boolean bot,
    long deltaLen,
    Instant eventTs,
    boolean hasGeo,
    Double lat,
    Double lon,
    String countryQid,
    String placeTypeQid,
    String h3R3,
    String h3R6,
    String h3R9,
    String url
) {}
