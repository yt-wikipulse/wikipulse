package com.springboot.web.wikipulseproject.controller;


import com.springboot.web.wikipulseproject.model.dto.DashboardResponse;
import com.springboot.web.wikipulseproject.service.DashboardService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardResponse> getDashboard(
        @RequestParam("period") String period,
        @RequestParam(value = "limit", defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(dashboardService.getDashboard(period, limit));
    }
}
