package tech.wikipulse.backend.controller;

import tech.wikipulse.backend.error.BadRequestException;
import tech.wikipulse.backend.model.dto.DashboardResponse;
import tech.wikipulse.backend.service.DashboardService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;

@RestController
@RequestMapping("/api/v1")
public class DashboardController {

    private static final Set<String> PERIODS = Set.of("24h", "7d", "30d");
    private static final int MIN_LIMIT = 1;
    private static final int MAX_LIMIT = 100;

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardResponse> getDashboard(
        @RequestParam("period") String period,
        @RequestParam(value = "limit", defaultValue = "10") int limit
    ) {
        if (!PERIODS.contains(period)) {
            throw new BadRequestException("period must be one of 24h, 7d, 30d");
        }
        if (limit < MIN_LIMIT || limit > MAX_LIMIT) {
            throw new BadRequestException("limit must be between " + MIN_LIMIT + " and " + MAX_LIMIT);
        }
        return ResponseEntity.ok(dashboardService.getDashboard(period, limit));
    }
}
