package tech.wikipulse.backend.model;

public record EnrichedEvent(
    long rowIndex,
    String eventId,
    String title,
    String url,
    String h3R9,
    long eventTs,
    long lengthUpdate,
    String diffUrl) {}
