package tech.wikipulse.backend.service.poller;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import tech.wikipulse.backend.model.EnrichedEvent;
import tech.wikipulse.backend.model.dto.DashboardResponse;
import tech.wikipulse.backend.model.TopGeoPlace;
import tech.wikipulse.backend.repository.RecentEventsCache;
import com.uber.h3core.H3Core;
import com.uber.h3core.util.LatLng;
import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

@Component
@Profile("mock")
public class MockPoller {

    private static final String EDITS_FIXTURE = "fixtures/q_enriched-sample.json";
    private static final String CELLS_FIXTURE = "fixtures/dashboard-24h.json";
    private static final int CELL_RESOLUTION = 9;

    private record SampleEdit(String id, String title, String url,
                              long lengthUpdate, String diffUrl, long eventTs) {}

    private final RecentEventsCache cache;
    private final Clock clock;
    private final List<EnrichedEvent> sample;
    private final long sampleEndTs;
    private final AtomicInteger cursor = new AtomicInteger();

    public MockPoller(RecentEventsCache cache, H3Core h3, Clock clock, ObjectMapper mapper) {
        this.cache = cache;
        this.clock = clock;
        this.sample = buildSample(h3, mapper);
        this.sampleEndTs = sample.stream().mapToLong(EnrichedEvent::eventTs).max().orElse(0L);
    }

    @PostConstruct
    void backfill() {
        long shift = clock.instant().getEpochSecond() - sampleEndTs;
        for (int i = 0; i < sample.size(); i++) {
            cache.put(replay(i, sample.get(i).eventTs() + shift, 0));
        }
    }

    @Scheduled(fixedDelay = 2_000)
    void emit() {
        int next = cursor.getAndIncrement();
        cache.put(replay(next % sample.size(), clock.instant().getEpochSecond(), next / sample.size() + 1));
    }

    private EnrichedEvent replay(int index, long eventTs, int pass) {
        EnrichedEvent origin = sample.get(index);
        return new EnrichedEvent(
            index,
            pass == 0 ? origin.eventId() : origin.eventId() + "#" + pass,
            origin.title(),
            origin.url(),
            origin.h3R9(),
            eventTs,
            origin.lengthUpdate(),
            origin.diffUrl());
    }

    private static List<EnrichedEvent> buildSample(H3Core h3, ObjectMapper mapper) {
        List<String> cells = cells(h3, mapper);
        List<SampleEdit> edits = read(mapper, EDITS_FIXTURE, new TypeReference<List<SampleEdit>>() {});

        List<EnrichedEvent> events = new ArrayList<>(edits.size());
        for (int i = 0; i < edits.size(); i++) {
            SampleEdit edit = edits.get(i);
            events.add(new EnrichedEvent(
                i,
                edit.id(),
                edit.title(),
                edit.url(),
                cells.get(Math.floorMod(wiki(edit.id()).hashCode(), cells.size())),
                edit.eventTs(),
                edit.lengthUpdate(),
                edit.diffUrl()));
        }
        return List.copyOf(events);
    }

    private static List<String> cells(H3Core h3, ObjectMapper mapper) {
        return read(mapper, CELLS_FIXTURE, new TypeReference<DashboardResponse>() {})
            .topGeo().stream()
            .map(TopGeoPlace::h3Parent)
            .distinct()
            .map(parent -> {
                LatLng center = h3.cellToLatLng(h3.stringToH3(parent));
                return h3.latLngToCellAddress(center.lat, center.lng, CELL_RESOLUTION);
            })
            .toList();
    }

    private static String wiki(String eventId) {
        int separator = eventId.indexOf('|');
        return separator < 0 ? eventId : eventId.substring(0, separator);
    }

    private static <T> T read(ObjectMapper mapper, String path, TypeReference<T> type) {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return mapper.readValue(in, type);
        } catch (IOException e) {
            throw new UncheckedIOException(path + " is not readable", e);
        }
    }
}
