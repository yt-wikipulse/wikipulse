package tech.wikipulse.backend.model;

public record TopArticle(
    String title,
    String url,
    long editsCount
) {}
