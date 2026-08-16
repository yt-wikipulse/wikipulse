package com.springboot.web.wikipulseproject.model.dto;

import java.util.List;

//ответ /api/v1/dashboard
public record DashboardResponse(
    String period,
    long totalEdits,
    List<TrendPointDto> trends,
    List<TopArticleDto> topArticles,
    List<TopGeoDto> topGeo
) {}
