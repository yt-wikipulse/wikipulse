package com.springboot.web.wikipulseproject.model.dto;

//точка графика trends[]: правки за один час
public record TrendPointDto(
    long bucketTs,
    long editsCount
) {}
