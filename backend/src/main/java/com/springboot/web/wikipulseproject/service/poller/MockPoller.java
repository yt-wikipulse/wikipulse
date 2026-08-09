package com.springboot.web.wikipulseproject.service.poller;

import com.springboot.web.wikipulseproject.model.EnrichedEvent;
import com.springboot.web.wikipulseproject.yt_repo.RecentEventsCache;
import com.uber.h3core.H3Core;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;

import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicLong;

/** Наполняет кэш выдуманными правками, пока нет чтения очереди. */
@Component
@Profile("mock")
public class MockPoller {

    private record Place(String title, String wiki, double lat, double lon) {}

    private static final List<Place> PLACES = List.of(
            new Place("Москва", "ru", 55.7558, 37.6173),
            new Place("Кремль", "ru", 55.7520, 37.6175),
            new Place("Санкт-Петербург", "ru", 59.9386, 30.3141),
            new Place("Eiffel Tower", "en", 48.8584, 2.2945),
            new Place("Louvre", "en", 48.8606, 2.3376),
            new Place("Berlin", "en", 52.5200, 13.4050),
            new Place("San Francisco", "en", 37.7749, -122.4194),
            new Place("Golden Gate Bridge", "en", 37.8199, -122.4783),
            new Place("Tokyo", "en", 35.6762, 139.6503),
            new Place("Sydney Opera House", "en", -33.8568, 151.2153)
    );

    private final RecentEventsCache cache;
    private final List<String> cellKeys;
    private final AtomicLong counter = new AtomicLong();

    public MockPoller(RecentEventsCache cache, H3Core h3) {
        this.cache = cache;
        this.cellKeys = PLACES.stream()
                .map(p -> h3.latLngToCellAddress(p.lat(), p.lon(), 9))
                .toList();
    }

    @Scheduled(fixedDelay = 2_000)
    void emit() {
        int i = ThreadLocalRandom.current().nextInt(PLACES.size());
        Place place = PLACES.get(i);

        cache.put(new EnrichedEvent(
                "mock-" + counter.incrementAndGet(),
                place.title(),
                "https://" + place.wiki() + ".wikipedia.org/wiki/"
                        + place.title().replace(' ', '_'),
                cellKeys.get(i)
        ));
    }
}
