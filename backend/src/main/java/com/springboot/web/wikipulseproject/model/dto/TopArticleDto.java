package com.springboot.web.wikipulseproject.model.dto;

//строка top_articles дашборда
public record TopArticleDto(
    String title,
    String url,
    long editsCount
) {}
