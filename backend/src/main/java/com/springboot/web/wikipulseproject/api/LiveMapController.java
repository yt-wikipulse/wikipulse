package com.springboot.web.wikipulseproject.api;

import com.springboot.web.wikipulseproject.error.BadRequestException;
import com.springboot.web.wikipulseproject.error.HotspotNotFoundException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** ВРЕМЕННАЯ ЗАГЛУШКА: фейковые данные строго по контракту rest-api.md. */
@RestController
@RequestMapping("/api")
public class LiveMapController {

    private static final String NOW = "2026-08-08T12:00:00Z";

    @GetMapping("/hotspots")
    public Map<String, Object> hotspots(
        @RequestParam(defaultValue = "6") int resolution,
        @RequestParam(required = false) List<String> lang,
        @RequestParam(name = "include_bots", defaultValue = "false") boolean includeBots) {

        if (resolution != 3 && resolution != 6 && resolution != 9) {
            throw new BadRequestException("resolution must be 3, 6 or 9"); // → 400
        }
        return Map.of(
            "meta", Map.of("generated_at", NOW, "window_minutes", 10, "resolution", resolution),
            "data", cellsFor(resolution, lang, includeBots));
    }

    @GetMapping("/hotspots/{h3}")
    public Map<String, Object> details(
        @PathVariable String h3,
        @RequestParam(required = false) List<String> lang,
        @RequestParam(name = "include_bots", defaultValue = "false") boolean includeBots) {

        List<Map<String, Object>> edits = mockEdits().stream()
            .filter(e -> lang == null || lang.isEmpty() || lang.contains(e.get("lang")))
            .filter(e -> includeBots || !((Boolean) e.get("bot")))
            .toList();

        if (edits.isEmpty()) {
            throw new HotspotNotFoundException(h3); // 404 по контракту
        }

        return Map.of(
            "h3", h3,
            "resolution", resolutionOf(h3),
            "generated_at", NOW,
            "edits_count", edits.size(),
            "users_count", edits.stream().map(e -> e.get("user")).distinct().count(),
            "top_pages", List.of(
                Map.of("title", "Eiffel Tower",
                    "url", "https://en.wikipedia.org/wiki/Eiffel_Tower",
                    "lang", "en", "edits_count", edits.size())),
            "recent_edits", edits.stream().limit(20).toList());
    }

    private record Cell(String h3, int resolution, double lat, double lon,
                        List<String> langs, long totalEdits, long humanEdits, long users) {}

    private List<Map<String, Object>> cellsFor(int resolution, List<String> lang, boolean includeBots) {
        List<Cell> cells = switch (resolution) {
            case 3 -> List.of(
                new Cell("832830fffffffff", 3, 48.858, 2.294, List.of("en", "ru", "fr"), 1240, 610, 610),
                new Cell("831f4afffffffff", 3, 52.52, 13.405, List.of("en", "ru", "de"), 980, 470, 470),
                new Cell("83289afffffffff", 3, 55.7558, 37.6173, List.of("ru"), 730, 350, 350));
            case 6 -> List.of(
                new Cell("861c1c97fffffff", 6, 48.858, 2.294, List.of("en", "ru", "fr"), 142, 88, 88),
                new Cell("861f4a8b7ffffff", 6, 52.52, 13.405, List.of("en", "ru", "de"), 98, 54, 54),
                new Cell("861fb2a17ffffff", 6, 55.7558, 37.6173, List.of("ru"), 76, 40, 40));
            default -> List.of(
                new Cell("891c1c97fffffff", 9, 48.8583, 2.2945, List.of("en", "fr"), 37, 21, 21),
                new Cell("891f4a8b7ffffff", 9, 52.5201, 13.4051, List.of("en", "de"), 25, 14, 14),
                new Cell("891fb2a17ffffff", 9, 55.7559, 37.6174, List.of("ru"), 18, 9, 9));
        };
        return cells.stream()
            .filter(c -> lang == null || lang.isEmpty()
                || c.langs().stream().anyMatch(lang::contains))
            .map(c -> cellJson(c, includeBots))
            .toList();
    }

    private Map<String, Object> cellJson(Cell c, boolean includeBots) {
        Map<String, Object> m = new HashMap<>();
        m.put("h3", c.h3());
        m.put("resolution", c.resolution());
        m.put("center", Map.of("lat", c.lat(), "lon", c.lon()));
        m.put("edits_count", includeBots ? c.totalEdits() : c.humanEdits());
        m.put("users_count", c.users());
        m.put("last_event_at", NOW);
        return m;
    }

    private List<Map<String, Object>> mockEdits() {
        return List.of(
            edit("enwiki|1234567890", "Eiffel Tower", "en", false, 42, "ExampleUser"),
            edit("ruwiki|987654321", "Эйфелева башня", "ru", false, 17, "IvanP"),
            edit("enwiki|1234567891", "Eiffel Tower", "en", true, 5, "BotCleaner"));
    }

    private Map<String, Object> edit(String id, String title, String lang,
                                     boolean bot, int deltaLen, String user) {
        Map<String, Object> m = new HashMap<>();
        m.put("edit_id", id);
        m.put("title", title);
        m.put("url", "https://" + lang + ".wikipedia.org/wiki/" + title.replace(" ", "_"));
        m.put("lang", lang);
        m.put("country", "FR");
        m.put("place_type", "landmark");
        m.put("type", "edit");
        m.put("bot", bot);
        m.put("delta_len", deltaLen);
        m.put("user", user);
        m.put("edited_at", NOW);
        return m;
    }

    private int resolutionOf(String h3) {
        if (h3 != null && h3.length() > 1) {
            int r = Character.getNumericValue(h3.charAt(1));
            if (r == 3 || r == 6 || r == 9) {
                return r;
            }
        }
        return 6;
    }
}
