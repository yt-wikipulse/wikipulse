package com.springboot.web.wikipulseproject.api;

import com.springboot.web.wikipulseproject.error.BadRequestException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** ВРЕМЕННАЯ ЗАГЛУШКА дашборда по новому контракту docs_03. */
@RestController
@RequestMapping("/api")
public class DashboardController {

    private static final String NOW = "2026-08-08T12:00:00Z";

    @GetMapping("/dashboard/summary")
    public Map<String, Object> summary(@RequestParam(defaultValue = "24h") String window) {
        return Map.of(
            "meta", Map.of("window", checkWindow(window), "generated_at", NOW),
            "data", Map.of(
                "total_edits", 50211,
                "top_country", Map.of("country_qid", "Q30", "edits_count", 12000),
                "top_wiki", Map.of("wiki", "enwiki", "edits_count", 28000)));
    }

    @GetMapping("/dashboard/top-places")
    public Map<String, Object> topPlaces(@RequestParam(defaultValue = "24h") String window,
                                         @RequestParam(defaultValue = "20") int limit) {
        checkWindow(window);
        List<Map<String, Object>> places = List.of(
            Map.of("country_qid", "Q30", "edits_count", 12000),
            Map.of("country_qid", "Q142", "edits_count", 8400),
            Map.of("country_qid", "Q183", "edits_count", 6100));
        return Map.of(
            "meta", Map.of("window", window, "generated_at", NOW),
            "data", places.stream().limit(limit).toList());
    }

    @GetMapping("/dashboard/trends")
    public Map<String, Object> trends(@RequestParam(defaultValue = "24h") String window) {
        return Map.of(
            "meta", Map.of("window", checkWindow(window), "step", "1h", "generated_at", NOW),
            "data", List.of(
                Map.of("bucket_start", "2026-08-08T10:00:00Z", "edits_count", 2103),
                Map.of("bucket_start", "2026-08-08T11:00:00Z", "edits_count", 2500)));
    }

    private String checkWindow(String window) {
        if (!List.of("1h", "24h", "7d").contains(window)) {
            throw new BadRequestException("window must be one of 1h, 24h, 7d");
        }
        return window;
    }
}
