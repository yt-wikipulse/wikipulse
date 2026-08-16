package com.springboot.web.wikipulseproject.controller;

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
import java.util.regex.Pattern;

/**
 * ВРЕМЕННЫЙ МОК дашборда по контракту docs/03-contracts/rest-api.md.
 * Форма ответа настоящая, цифры выдуманные — чтобы фронт верстал, пока
 * пишется DashboardService и пока не прогнали джобу витрин.
 * Когда сервис появится: выкинуть фикстуры, оставить контроллер тонким,
 * как LiveMapController.
 */
@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {

    private static final Pattern PERIOD_PATTERN = Pattern.compile("^(\\d+)h$");
    private static final int MAX_TOP = 100;
    private static final long HOUR_SECONDS = 3600L;

    @GetMapping
    public ResponseEntity<DashboardResponse> dashboard(
        @RequestParam(name = "period", defaultValue = "24h") String period,
        @RequestParam(name = "top", defaultValue = "5") int top
    ) {
        int hours = requireHours(period);
        List<TrendPointDto> trends = mockTrends(hours);
        long totalEdits = trends.stream().mapToLong(TrendPointDto::editsCount).sum();

        // Фикстуры топов написаны под сутки. Масштабируем их вместе с окном,
        // иначе за час «топ статья» набирает больше правок, чем весь поток.
        double scale = hours / 24.0;

        return ResponseEntity.ok(new DashboardResponse(
            period,
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

    private static long scaled(long value, double scale) {
        return Math.max(1, Math.round(value * scale));
    }

    private static int requireHours(String period) {
        var matcher = PERIOD_PATTERN.matcher(period == null ? "" : period);
        if (!matcher.matches()) {
            throw new BadRequestException("period must look like \"24h\", got: " + period);
        }
        int hours = Integer.parseInt(matcher.group(1));
        // Потолок — месяц: витрины дальше месяца фронт не запрашивает.
        if (hours < 1 || hours > 744) {
            throw new BadRequestException("period must be between 1h and 744h, got: " + period);
        }
        return hours;
    }

    // Суточная волна: ночью тихо, днём пик — чтобы график не выглядел ровной стеной.
    // Привязана к номеру часа, а не к random: между поллингами цифры не скачут.
    private static List<TrendPointDto> mockTrends(int hours) {
        long currentBucket = Instant.now().getEpochSecond() / HOUR_SECONDS * HOUR_SECONDS;
        List<TrendPointDto> points = new ArrayList<>(hours);
        for (int i = hours - 1; i >= 0; i--) {
            long bucketTs = currentBucket - i * HOUR_SECONDS;
            int hourOfDay = (int) (bucketTs / HOUR_SECONDS % 24);
            double wave = Math.sin((hourOfDay - 3) / 24.0 * 2 * Math.PI);
            points.add(new TrendPointDto(bucketTs, Math.round(3200 + 2400 * wave)));
        }
        return points;
    }

    private static <T> List<T> trim(List<T> rows, int top) {
        if (top < 1) {
            throw new BadRequestException("top must be at least 1, got: " + top);
        }
        return rows.subList(0, Math.min(rows.size(), Math.min(top, MAX_TOP)));
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
}
