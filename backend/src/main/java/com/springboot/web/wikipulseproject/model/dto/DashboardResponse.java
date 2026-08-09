package com.springboot.web.wikipulseproject.model.dto;

import java.util.List;

//ответ /api/dashboard
public record DashboardResponse(
    long totalEvents,
    List<TopArticleDto> topArticles
) {}
