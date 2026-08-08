package com.springboot.web.wikipulseproject.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** ВРЕМЕННАЯ ЗАГЛУШКА: отдаёт фейковые данные, чтобы фронт мог работать. */
@RestController
@RequestMapping("/api")
public class LiveMapController {

    @GetMapping("/hotspots")
    public Map<String, Object> hotspots() {
        return Map.of(
                "meta", Map.of(
                        "generated_at", "2026-08-08T12:00:00Z",
                        "window_minutes", 10,
                        "resolution", 6),
                "data", List.of(
                        Map.of("h3", "861c1c97fffffff", "resolution", 6,
                                "center", Map.of("lat", 48.858, "lon", 2.294),
                                "edits_count", 142, "users_count", 88,
                                "last_event_at", "2026-08-08T11:58:00Z"),
                        Map.of("h3", "861f4a8b7ffffff", "resolution", 6,
                                "center", Map.of("lat", 52.52, "lon", 13.405),
                                "edits_count", 98, "users_count", 54,
                                "last_event_at", "2026-08-08T11:57:00Z")));
    }

    @GetMapping("/hotspots/{h3}")
    public Map<String, Object> details(@PathVariable String h3) {
        // 11 полей — больше лимита Map.of (10 пар), поэтому HashMap
        Map<String, Object> edit = new HashMap<>();
        edit.put("edit_id", "enwiki|1234567890");
        edit.put("title", "Eiffel Tower");
        edit.put("url", "https://en.wikipedia.org/wiki/Eiffel_Tower");
        edit.put("lang", "en");
        edit.put("country", "FR");
        edit.put("place_type", "landmark");
        edit.put("type", "edit");
        edit.put("bot", false);
        edit.put("delta_len", 42);
        edit.put("user", "ExampleUser");
        edit.put("edited_at", "2026-08-08T11:58:00Z");

        return Map.of(
                "h3", h3,
                "resolution", 6,
                "generated_at", "2026-08-08T12:00:00Z",
                "edits_count", 520,
                "users_count", 240,
                "top_pages", List.of(
                        Map.of("title", "Eiffel Tower",
                                "url", "https://en.wikipedia.org/wiki/Eiffel_Tower",
                                "lang", "en", "edits_count", 142)),
                "recent_edits", List.of(edit));
    }
}