package tech.wikipulse.backend.service;

import tech.wikipulse.backend.error.BadRequestException;
import tech.wikipulse.backend.model.TopArticle;
import tech.wikipulse.backend.model.TopGeoPlace;
import tech.wikipulse.backend.model.TrendPoint;
import tech.wikipulse.backend.model.dto.DashboardResponse;
import tech.wikipulse.backend.repository.YtAggregatesRepository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Profile("yt")
@Service
public class YtDashboardService implements DashboardService {

    private static final long HOUR_SECONDS = 3600L;
    private static final long DAY_SECONDS = 86400L;

    private final YtAggregatesRepository repository;

    public YtDashboardService(YtAggregatesRepository repository) {
        this.repository = repository;
    }

    /**
     * Собирает ответ дашборда из трёх витрин.
     *
     * <p>Кэшируется готовый ответ, а не походы в репозиторий: в него попадает
     * и свёртка 720 часовых точек в суточные, которую иначе пришлось бы делать
     * на каждый запрос. Ключ кэша — {@code period} и {@code limit} вместе:
     * без {@code limit} в ключе запрос на десять строк получил бы ответ,
     * собранный для сотни. Исключения не кэшируются, поэтому недоступность YT
     * не залипает на минуту.
     *
     * <p>{@code generated_at} — время сборки ответа, а не время пересчёта
     * витрин: атрибут {@code @computed_at} у витрин есть, но репозиторий его
     * не читает.
     */
    @Override
    @Cacheable("dashboard")
    public DashboardResponse getDashboard(String period, int limit) {
        String periodInHours = translatePeriod(period);
        long fromBucketTs = Instant.now().getEpochSecond() - periodToSeconds(period);

        List<TrendPoint> trends = repository.fetchTrends(fromBucketTs);
        List<TopArticle> topArticles = repository.fetchTopArticles(periodInHours, limit);
        List<TopGeoPlace> topGeoPlaces = repository.fetchTopGeo(periodInHours, limit);

        List<TrendPoint> processedTrends = processTrends(period, trends);
        long totalEdits = processedTrends.stream().mapToLong(TrendPoint::editsCount).sum();

        return new DashboardResponse(
            period,
            Instant.now().getEpochSecond(),
            (int) bucketSeconds(period),
            totalEdits,
            processedTrends,
            topArticles,
            topGeoPlaces);
    }

    /**
     * Период контракта в значение колонки {@code period} витрин топов
     * ({@code 24h}, {@code 168h}, {@code 720h}).
     */
    private String translatePeriod(String period) {
        return switch (period) {
            case "24h" -> "24h";
            case "7d" -> "168h";
            case "30d" -> "720h";
            default -> throw new BadRequestException("period must be one of 24h, 7d, 30d");
        };
    }

    private long bucketSeconds(String period) {
        return "30d".equals(period) ? DAY_SECONDS : HOUR_SECONDS;
    }

    /**
     * Период контракта в длительность — нижнюю границу {@code bucket_ts}
     * для трендов. Второй перевод того же периода нужен потому, что
     * у {@code marts/trends} колонки периода нет вовсе и отрезок выбирается
     * только фильтром по времени.
     */
    private long periodToSeconds(String period) {
        return switch (period) {
            case "24h" -> 24 * HOUR_SECONDS;
            case "7d" -> 7 * DAY_SECONDS;
            case "30d" -> 30 * DAY_SECONDS;
            default -> throw new BadRequestException("period must be one of 24h, 7d, 30d");
        };
    }

    /**
     * Свёртка часовых бакетов в суточные для периода {@code 30d}.
     *
     * <p>Делается на бэкенде, а не в витрине: {@code marts/trends} хранит только
     * часовые бакеты, а отдельный суточный пересчёт в пайплайне ради одного
     * экрана не окупается. Границы суток берутся по UTC — так же считает
     * фронтенд, когда сворачивает неделю.
     */
    private List<TrendPoint> processTrends(String period, List<TrendPoint> hourlyPoints) {
        if (!"30d".equals(period)) {
            return hourlyPoints;
        }

        Map<Long, Long> dailyAggregates = new HashMap<>();
        for (TrendPoint point : hourlyPoints) {
            dailyAggregates.merge(point.bucketTs() / DAY_SECONDS * DAY_SECONDS, point.editsCount(), Long::sum);
        }

        List<TrendPoint> dailyPoints = new ArrayList<>();
        dailyAggregates.forEach((dayStart, editsCount) -> dailyPoints.add(new TrendPoint(dayStart, editsCount)));
        dailyPoints.sort(java.util.Comparator.comparingLong(TrendPoint::bucketTs));

        return dailyPoints;
    }
}
