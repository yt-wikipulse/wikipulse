package com.springboot.web.wikipulseproject.service.poller;

import com.springboot.web.wikipulseproject.model.EnrichedEvent;
import com.springboot.web.wikipulseproject.yt_repo.RecentEventsCache;
import com.uber.h3core.H3Core;
import java.time.Clock;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicLong;

@Component
@Profile("mock")
public class MockPoller {

    private record Place(String title, String url, double lat, double lon) {}

    private static final List<Place> PLACES = List.of(
        new Place("Москва", "https://ru.wikipedia.org/wiki/Москва", 55.7558, 37.6173),
        new Place("Кремль", "https://ru.wikipedia.org/wiki/Московский_Кремль", 55.7520, 37.6175),
        new Place("Санкт-Петербург", "https://ru.wikipedia.org/wiki/Санкт-Петербург", 59.9386, 30.3141),
        new Place("Eiffel Tower", "https://en.wikipedia.org/wiki/Eiffel_Tower", 48.8584, 2.2945),
        new Place("Louvre", "https://en.wikipedia.org/wiki/Louvre", 48.8606, 2.3376),
        new Place("Berlin", "https://en.wikipedia.org/wiki/Berlin", 52.5200, 13.4050),
        new Place("San Francisco", "https://en.wikipedia.org/wiki/San_Francisco", 37.7749, -122.4194),
        new Place("Golden Gate Bridge", "https://en.wikipedia.org/wiki/Golden_Gate_Bridge", 37.8199, -122.4783),
        new Place("Tokyo", "https://en.wikipedia.org/wiki/Tokyo", 35.6762, 139.6503),
        new Place("Sydney Opera House", "https://en.wikipedia.org/wiki/Sydney_Opera_House", -33.8568, 151.2153)
    );

    private final RecentEventsCache cache;
    private final Clock clock;
    /** «Готовые» h3_r9 по одному на место — как если бы их прислала очередь. */
    private final List<String> cellKeys;
    private final AtomicLong counter = new AtomicLong();

    public MockPoller(RecentEventsCache cache, H3Core h3, Clock clock) {
        this.cache = cache;
        this.clock = clock;
        this.cellKeys = PLACES.stream()
            .map(p -> h3.latLngToCellAddress(p.lat(), p.lon(), 9))
            .toList();
    }

    @Scheduled(fixedDelay = 2_000)
    void emit() {
        int i = ThreadLocalRandom.current().nextInt(PLACES.size());
        Place place = PLACES.get(i);
        long n = counter.incrementAndGet();
        cache.put(new EnrichedEvent(
            n,
            "mock-" + n,
            place.title(),
            place.url(),
            cellKeys.get(i),
            clock.instant().getEpochSecond(),
            ThreadLocalRandom.current().nextLong(50, 5000),
            place.url() + "?diff=" + n
        ));
    }
}
