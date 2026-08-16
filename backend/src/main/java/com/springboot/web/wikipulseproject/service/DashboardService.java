package com.springboot.web.wikipulseproject.service;

import com.springboot.web.wikipulseproject.error.BadRequestException;
import com.springboot.web.wikipulseproject.model.TopArticle;
import com.springboot.web.wikipulseproject.model.TopGeoPlace;
import com.springboot.web.wikipulseproject.model.TrendPoint;
import com.springboot.web.wikipulseproject.model.dto.DashboardResponse;
import com.springboot.web.wikipulseproject.yt_repo.YtAggregatesRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

@Service
@Slf4j
public class DashboardService {

    private static final Set<String> VALID_PERIODS = Set.of("24h", "7d", "30d");
    private static final int MIN_LIMIT = 1;
    private static final int MAX_LIMIT = 100;

    private final YtAggregatesRepository repository;

    public DashboardService(YtAggregatesRepository repository) {
        this.repository = repository;
    }

    @Cacheable("dashboard")
    public DashboardResponse getDashboard(String period, int limit) {
        log.info("вызов getDashboard");

        if (!VALID_PERIODS.contains(period)) {
            throw new BadRequestException("period must be one of 24h, 7d, 30d");
        }
        if (limit < MIN_LIMIT || limit > MAX_LIMIT) {
            throw new BadRequestException("limit must be between 1 and 100");
        }

        String periodInHours = translatePeriod(period);

        int bucketSeconds = calculateBucketSeconds(period);
        long fromBucketTs = Instant.now().getEpochSecond() - periodToSeconds(period);

        //три чтения из витрин параллельно
        List<TrendPoint> trends = repository.fetchTrends(fromBucketTs, limit);
        List<TopArticle> topArticles = repository.fetchTopArticles(periodInHours, limit);
        List<TopGeoPlace> topGeoPlaces = repository.fetchTopGeo(periodInHours, limit);

        //свертка для 30 дней
        List<TrendPoint> processedTrends = processTrends(period, trends);

        long totalEdits = processedTrends.stream().mapToLong(TrendPoint::editsCount).sum();

        long generatedAt = Instant.now().getEpochSecond();

        return new DashboardResponse(period, generatedAt, bucketSeconds, totalEdits, processedTrends, topArticles, topGeoPlaces);
    }

    private String translatePeriod(String period) {
        return switch (period) {
            case "24h" -> "24h";
            case "7d" -> "168h";
            case "30d" -> "720h";
            default -> throw new BadRequestException("unexpected period: " + period);
        };
    }

    private int calculateBucketSeconds(String period) {
        return "30d".equals(period) ? 86400 : 3600;
    }

    private long periodToSeconds(String period) {
        return switch (period) {
            case "24h" -> 24 * 3600L;
            case "7d" -> 7 * 24 * 3600L;
            case "30d" -> 30 * 24 * 3600L;
            default -> throw new IllegalStateException("unexpected period: " + period);
        };
    }

    //свёртка trends для 30d складываем часовые точки в суточные
    private List<TrendPoint> processTrends(String period, List<TrendPoint> hourlyPoints) {
        if (!"30d".equals(period)) {
            return hourlyPoints;
        }

        //группируем по суткам
        Map<Long, Long> dailyAggregates = new HashMap<>();
        for (TrendPoint point : hourlyPoints) {
            long dayStart = (point.bucketTs() / 86400) * 86400;  // начало суток
            dailyAggregates.merge(dayStart, point.editsCount(), Long::sum);
        }

        List<TrendPoint> dailyPoints = new ArrayList<>();
        dailyAggregates.forEach((dayStart, editsCount) ->
            dailyPoints.add(new TrendPoint(dayStart, editsCount)));

        //сортируем по времени
        dailyPoints.sort((a, b) -> Long.compare(a.bucketTs(), b.bucketTs()));

        return dailyPoints;
    }
}
