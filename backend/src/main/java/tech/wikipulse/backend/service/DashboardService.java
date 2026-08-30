package tech.wikipulse.backend.service;

import tech.wikipulse.backend.model.dto.DashboardResponse;

public interface DashboardService {

    DashboardResponse getDashboard(String period, int limit);
}
