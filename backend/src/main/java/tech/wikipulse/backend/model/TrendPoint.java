package tech.wikipulse.backend.model;

public record TrendPoint(
    long bucketTs,
    long editsCount
) {}
