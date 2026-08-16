package com.springboot.web.wikipulseproject.model.dto;

//строка top_geo дашборда: ячейка H3 и её самая правимая статья
public record TopGeoDto(
    String h3Parent,
    String topTitle,
    String topUrl,
    long editsCount,
    long articlesCount
) {}
