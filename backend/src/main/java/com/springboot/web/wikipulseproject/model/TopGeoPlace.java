package com.springboot.web.wikipulseproject.model;

//строка marts/top_geo: гео-ячейка за период,
//top_title/top_url — самая правимая статья ячейки
public record TopGeoPlace(
    String h3Parent,
    String topTitle,
    String topUrl,
    long editsCount,
    long articlesCount
) {}
