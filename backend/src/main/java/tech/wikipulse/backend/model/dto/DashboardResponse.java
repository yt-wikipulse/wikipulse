package tech.wikipulse.backend.model.dto;

import tech.wikipulse.backend.model.TopArticle;
import tech.wikipulse.backend.model.TopGeoPlace;
import tech.wikipulse.backend.model.TrendPoint;

import java.util.List;

public record DashboardResponse(
    String period,
    long generatedAt,
    int bucketSeconds,
    long totalEdits,
    List<TrendPoint> trends,
    List<TopArticle> topArticles,
    List<TopGeoPlace> topGeo
) {}
