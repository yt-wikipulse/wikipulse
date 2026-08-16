package com.springboot.web.wikipulseproject.model;

//строка marts/top_articles: статья и её правки за период
public record TopArticle(
    String title,
    String url,
    long editsCount
) {}
