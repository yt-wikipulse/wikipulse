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
import java.util.Set;

/** ВРЕМЕННАЯ ЗАГЛУШКА по новому контракту docs_03. */
@RestController
@RequestMapping("/api")
public class LiveMapController {

    private static final String NOW = "2026-08-08T12:00:00Z";
    private static final int WINDOW_SECONDS = 60;

    // Валидные H3: каноническая цепочка из H3 docs (r3⊃r6⊃r9, Сан-Франциско)
    // + подтверждённый фронтом Париж (r6)
    private static final Map<Integer, List<Map<String, Object>>> CELLS = Map.of(
        3, List.of(cell("832830fffffffff", 3, 37.77, -122.42, 1240, 610)),
        6, List.of(cell("86283082fffffff", 6, 37.77, -122.42, 98, 54),
            cell("861c1c97fffffff", 6, 48.858, 2.294, 142, 88)),
        9, List.of(cell("8928308280fffff", 9, 37.7749, -122.4194, 37, 21)));

    private static final Set<String> KNOWN_H3 = Set.of(
        "832830fffffffff", "86283082fffffff", "861c1c97fffffff", "8928308280fffff");

    @GetMapping("/hotspots")
    public Map<String, Object> hotspots(
        @RequestParam(defaultValue = "6") int resolution,
        @RequestParam(required = false) List<String> lang,   // мок: принимаем, фильтр придёт с сервисами
        @RequestParam(name = "include_bots", defaultValue = "false") boolean includeBots) {
        if (!CELLS.containsKey(resolution)) {
            throw new BadRequestException("resolution must be one of 3, 6, 9");
        }
        return Map.of(
            "meta", Map.of("generated_at", NOW, "window_seconds", WINDOW_SECONDS,
                "resolution", resolution),
            "data", CELLS.get(resolution));
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

        if (!KNOWN_H3.contains(h3) || edits.isEmpty()) {
            throw new HotspotNotFoundException(h3);   // → 404 с текстом из контракта
        }

        return Map.of(
            "h3", h3,
            "resolution", resolutionOf(h3),
            "generated_at", NOW,
            "edits_count", edits.size(),
            "users_count", edits.stream().map(e -> e.get("user")).distinct().count(),
            "top_pages", List.of(Map.of(
                "title", "Eiffel Tower",
                "url", "https://en.wikipedia.org/wiki/Eiffel_Tower",
                "lang", "en",
                "edits_count", 142)),
            "recent_edits", edits.stream().limit(20).toList());
    }

    private static Map<String, Object> cell(String h3, int resolution, double lat, double lon,
                                            long editsCount, long usersCount) {
        return Map.of(
            "h3", h3,
            "resolution", resolution,
            "center", Map.of("lat", lat, "lon", lon),
            "edits_count", editsCount,
            "users_count", usersCount,
            "last_event_at", NOW);
    }

    private List<Map<String, Object>> mockEdits() {
        return List.of(
            edit("enwiki|1234567890", "Eiffel Tower", "en", false, 42, "ExampleUser",
                "https://en.wikipedia.org/wiki/Eiffel_Tower"),
            edit("ruwiki|987654321", "Эйфелева башня", "ru", false, 17, "IvanP",
                "https://ru.wikipedia.org/wiki/%D0%AD%D0%B9%D1%84%D0%B5%D0%BB%D0%B5%D0%B2%D0%B0_%D0%B1%D0%B0%D1%88%D0%BD%D1%8F"),
            edit("enwiki|1234567891", "Eiffel Tower", "en", true, 5, "BotCleaner",
                "https://en.wikipedia.org/wiki/Eiffel_Tower"));
    }

    private Map<String, Object> edit(String id, String title, String lang, boolean bot,
                                     int deltaLen, String user, String url) {
        Map<String, Object> m = new HashMap<>();
        m.put("edit_id", id);
        m.put("title", title);
        m.put("url", url);
        m.put("lang", lang);
        m.put("country_code", "FR");
        m.put("place_type", "landmark");
        m.put("type", "edit");
        m.put("bot", bot);
        m.put("delta_len", deltaLen);
        m.put("user", user);
        m.put("edited_at", NOW);
        return m;
    }

    /** Резолюция зашита во втором hex-символе H3-индекса: 83…→3, 86…→6, 89…→9. */
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
