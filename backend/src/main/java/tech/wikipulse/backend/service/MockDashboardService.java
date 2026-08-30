package tech.wikipulse.backend.service;

import tools.jackson.databind.ObjectMapper;
import tech.wikipulse.backend.error.BadRequestException;
import tech.wikipulse.backend.model.dto.DashboardResponse;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Profile("mock")
@Service
public class MockDashboardService implements DashboardService {

    private static final List<String> PERIODS = List.of("24h", "7d", "30d");

    private final Map<String, DashboardResponse> fixtures;

    public MockDashboardService(ObjectMapper mapper) {
        this.fixtures = PERIODS.stream()
            .collect(Collectors.toMap(period -> period, period -> read(mapper, period)));
    }

    @Override
    public DashboardResponse getDashboard(String period, int limit) {
        DashboardResponse fixture = fixtures.get(period);
        if (fixture == null) {
            throw new BadRequestException("period must be one of 24h, 7d, 30d");
        }
        return new DashboardResponse(
            fixture.period(),
            fixture.generatedAt(),
            fixture.bucketSeconds(),
            fixture.totalEdits(),
            fixture.trends(),
            trim(fixture.topArticles(), limit),
            trim(fixture.topGeo(), limit));
    }

    private static <T> List<T> trim(List<T> rows, int limit) {
        return rows.subList(0, Math.min(rows.size(), limit));
    }

    private static DashboardResponse read(ObjectMapper mapper, String period) {
        try (InputStream in = new ClassPathResource("fixtures/dashboard-" + period + ".json").getInputStream()) {
            return mapper.readValue(in, DashboardResponse.class);
        } catch (IOException e) {
            throw new UncheckedIOException("fixtures/dashboard-" + period + ".json is not readable", e);
        }
    }
}
