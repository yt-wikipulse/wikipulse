package com.springboot.web.wikipulseproject.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** ВРЕМЕННАЯ ЗАГЛУШКА для дашборда. */
@RestController
@RequestMapping("/api")
public class DashboardController {

    @GetMapping("/dashboard/summary")
    public Map<String, Object> summary() {
        return Map.of(
                "meta", Map.of("window", "24h", "generated_at", "2026-08-08T12:00:00Z"),
                "data", Map.of("total_edits", 50211, "active_hotspots", 1840,
                        "active_pages", 32900,
                        "top_language", Map.of("lang", "en", "edits_count", 28000)));
    }

    @GetMapping("/dashboard/top-places")
    public Map<String, Object> topPlaces() {
        return Map.of(
                "meta", Map.of("window", "24h", "generated_at", "2026-08-08T12:00:00Z"),
                "data", List.of(
                        Map.of("h3", "861c1c97fffffff", "resolution", 6,
                                "center", Map.of("lat", 48.858, "lon", 2.294),
                                "edits_count", 142,
                                "top_pages", List.of(
                                        Map.of("title", "Eiffel Tower",
                                                "url", "https://en.wikipedia.org/wiki/Eiffel_Tower",
                                                "lang", "en", "edits_count", 60)))));
    }

    @GetMapping("/dashboard/trends")
    public Map<String, Object> trends() {
        return Map.of(
                "meta", Map.of("window", "24h", "step", "1h", "generated_at", "2026-08-08T12:00:00Z"),
                "data", List.of(
                        Map.of("bucket_start", "2026-08-08T11:00:00Z", "edits_count", 2103),
                        Map.of("bucket_start", "2026-08-08T12:00:00Z", "edits_count", 2500)));
    }
}