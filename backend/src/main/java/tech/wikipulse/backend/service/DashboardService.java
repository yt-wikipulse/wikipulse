package tech.wikipulse.backend.service;

import tech.wikipulse.backend.model.dto.DashboardResponse;

/**
 * Источник данных дашборда. Две реализации выбираются профилем:
 * {@link YtDashboardService} на {@code yt} и {@link MockDashboardService}
 * на {@code mock}. {@code @Profile} стоит на реализациях, а не на контроллере:
 * контроллер один и работает на обоих профилях.
 */
public interface DashboardService {

    DashboardResponse getDashboard(String period, int limit);
}
