package com.springboot.web.wikipulseproject.controller;

/**
import com.springboot.web.wikipulseproject.error.BadRequestException;
import com.springboot.web.wikipulseproject.model.dto.DashboardResponse;
import com.springboot.web.wikipulseproject.model.dto.TopArticleDto;
import com.springboot.web.wikipulseproject.model.dto.TopGeoDto;
import com.springboot.web.wikipulseproject.model.dto.TrendPointDto;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;


 * ВРЕМЕННЫЙ МОК дашборда по контракту docs/03-contracts/rest-api.md.
 * Форма ответа настоящая, цифры выдуманные — чтобы фронт верстал, пока
 * пишется DashboardService и пока не прогнали джобу витрин.
 * Когда сервис появится: выкинуть фикстуры, оставить контроллер тонким,
 * как LiveMapController.

@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {

    private static final long HOUR_SECONDS = 3600L;
    private static final long DAY_SECONDS = 86400L;
    private static final int MAX_LIMIT = 100;

    // Окна контракта: сколько часов витрины и с каким шагом рисуется график.
    private static final Map<String, Window> WINDOWS = Map.of(
        "24h", new Window(24, HOUR_SECONDS),
        "7d", new Window(168, HOUR_SECONDS),
        "30d", new Window(720, DAY_SECONDS));

    private record Window(int hours, long bucketSeconds) {}

    @GetMapping
    public ResponseEntity<DashboardResponse> dashboard(
        @RequestParam(name = "period", defaultValue = "24h") String period,
        @RequestParam(name = "limit", defaultValue = "10") int limit
    ) {
        Window window = requireWindow(period);
        int top = requireLimit(limit);

        List<TrendPointDto> trends = mockTrends(window);
        long totalEdits = trends.stream().mapToLong(TrendPointDto::editsCount).sum();

        // Фикстуры топов написаны под сутки. Масштабируем их вместе с окном,
        // иначе за сутки «топ статья» наберёт столько же, сколько за месяц.
        double scale = window.hours() / 24.0;

        return ResponseEntity.ok(new DashboardResponse(
            period,
            Instant.now().getEpochSecond() / HOUR_SECONDS * HOUR_SECONDS,
            window.bucketSeconds(),
            totalEdits,
            trends,
            trim(MOCK_TOP_ARTICLES, top).stream()
                .map(article -> new TopArticleDto(article.title(), article.url(),
                    scaled(article.editsCount(), scale)))
                .toList(),
            trim(MOCK_TOP_GEO, top).stream()
                .map(place -> new TopGeoDto(place.h3Parent(), place.topTitle(), place.topUrl(),
                    scaled(place.editsCount(), scale), scaled(place.articlesCount(), scale)))
                .toList()));
    }

    private static Window requireWindow(String period) {
        Window window = WINDOWS.get(period);
        if (window == null) {
            throw new BadRequestException(
                "period must be one of 24h, 7d, 30d, got: " + period);
        }
        return window;
    }

    private static int requireLimit(int limit) {
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new BadRequestException(
                "limit must be between 1 and " + MAX_LIMIT + ", got: " + limit);
        }
        return limit;
    }

    // Суточная волна: ночью тихо, днём пик — чтобы график не выглядел ровной
    // стеной. Привязана к номеру часа, а не к random: цифры не скачут между
    // запросами. Часы складываются в бакеты того шага, что задал контракт.
    private static List<TrendPointDto> mockTrends(Window window) {
        long currentBucket = Instant.now().getEpochSecond() / HOUR_SECONDS * HOUR_SECONDS;
        List<TrendPointDto> points = new ArrayList<>();
        long openBucketTs = -1;
        long openEdits = 0;

        for (int i = window.hours() - 1; i >= 0; i--) {
            long hourTs = currentBucket - i * HOUR_SECONDS;
            long bucketTs = hourTs / window.bucketSeconds() * window.bucketSeconds();

            if (bucketTs != openBucketTs) {
                if (openBucketTs >= 0) {
                    points.add(new TrendPointDto(openBucketTs, openEdits));
                }
                openBucketTs = bucketTs;
                openEdits = 0;
            }

            openEdits += hourlyEdits(hourTs);
        }

        if (openBucketTs >= 0) {
            points.add(new TrendPointDto(openBucketTs, openEdits));
        }

        return points;
    }

    private static long hourlyEdits(long hourTs) {
        int hourOfDay = (int) (hourTs / HOUR_SECONDS % 24);
        double wave = Math.sin((hourOfDay - 3) / 24.0 * 2 * Math.PI);
        return Math.round(3200 + 2400 * wave);
    }

    private static long scaled(long value, double scale) {
        return Math.max(1, Math.round(value * scale));
    }

    private static <T> List<T> trim(List<T> rows, int top) {
        return rows.subList(0, Math.min(rows.size(), top));
    }

    private static final List<TopArticleDto> MOCK_TOP_ARTICLES = List.of(
        new TopArticleDto("2026 United States Senate elections",
            "https://en.wikipedia.org/wiki/2026_United_States_Senate_elections", 18420),
        new TopArticleDto("Federal Reserve",
            "https://en.wikipedia.org/wiki/Federal_Reserve", 11960),
        new TopArticleDto("Москва",
            "https://ru.wikipedia.org/wiki/Москва", 9840),
        new TopArticleDto("Tour Eiffel",
            "https://fr.wikipedia.org/wiki/Tour_Eiffel", 7310),
        new TopArticleDto("Frida Kahlo",
            "https://es.wikipedia.org/wiki/Frida_Kahlo", 6180),
        new TopArticleDto("Brooklyn Bridge",
            "https://en.wikipedia.org/wiki/Brooklyn_Bridge", 4270),
        new TopArticleDto("Berlin",
            "https://de.wikipedia.org/wiki/Berlin", 3150));

    // h3_parent — настоящие ячейки резолюции 4, как их пишет джоба витрин:
    // фронт может считать по ним геометрию и не упасть.
    private static final List<TopGeoDto> MOCK_TOP_GEO = List.of(
        new TopGeoDto("842a107ffffffff", "Brooklyn Bridge",
            "https://en.wikipedia.org/wiki/Brooklyn_Bridge", 12480, 312),
        new TopGeoDto("84194adffffffff", "Tower of London",
            "https://en.wikipedia.org/wiki/Tower_of_London", 9310, 244),
        new TopGeoDto("8411aa7ffffffff", "Москва",
            "https://ru.wikipedia.org/wiki/Москва", 8120, 198),
        new TopGeoDto("841fb47ffffffff", "Tour Eiffel",
            "https://fr.wikipedia.org/wiki/Tour_Eiffel", 6440, 157),
        new TopGeoDto("844995bffffffff", "Teotihuacán",
            "https://es.wikipedia.org/wiki/Teotihuac%C3%A1n", 4980, 121),
        new TopGeoDto("842f5a3ffffffff", "東京タワー",
            "https://ja.wikipedia.org/wiki/東京タワー", 3760, 96));
*/

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
