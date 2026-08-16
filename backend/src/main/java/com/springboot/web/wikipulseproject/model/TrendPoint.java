package com.springboot.web.wikipulseproject.model;

//строка marts/trends: правки за один час
public record TrendPoint(
    long bucketTs,
    long editsCount
) {}
