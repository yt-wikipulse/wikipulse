package tech.wikipulse.backend.model;

public record TopGeoPlace(
    String h3Parent,
    String topTitle,
    String topUrl,
    long editsCount,
    long articlesCount
) {}
