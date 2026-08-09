package com.springboot.web.wikipulseproject.model;

public record EnrichedEvent (
    String eventId,
    String title,
    String url,
    String h3_r9
) {}
