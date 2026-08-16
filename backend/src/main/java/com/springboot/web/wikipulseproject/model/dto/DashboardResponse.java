package com.springboot.web.wikipulseproject.model.dto;

import com.springboot.web.wikipulseproject.model.TopArticle;
import com.springboot.web.wikipulseproject.model.TopGeoPlace;
import com.springboot.web.wikipulseproject.model.TrendPoint;

import java.util.List;

//ответ /api/dashboard
public record DashboardResponse(
    String period,
    long generatedAt,
    int bucketSeconds,
    long totalEdits,
    List<TrendPoint> trends,
    List<TopArticle> topArticles,
    List<TopGeoPlace> topGeo
) {}
