package com.springboot.web.wikipulseproject.yt_repo;

import com.springboot.web.wikipulseproject.model.EnrichedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class InMemoryRecentEventsCacheTest {

    private static final long WINDOW_MINUTES = 30;
    private static final String CELL_A = "8928308280fffff";
    private static final String CELL_B = "89283082807ffff";

    private final java.util.concurrent.atomic.AtomicLong rowIndex =
            new java.util.concurrent.atomic.AtomicLong();

    private MutableClock clock;
    private InMemoryRecentEventsCache cache;

    @BeforeEach
    void setUp() {
        clock = new MutableClock(Instant.parse("2026-08-09T12:00:00Z"));
        cache = new InMemoryRecentEventsCache(clock, WINDOW_MINUTES);
    }

    @Test
    void duplicateEventAppearsOnceInSnapshot() {
        cache.put(event("e1", CELL_A));
        cache.put(event("e1", CELL_A));

        assertEquals(1, cache.snapshot().get(CELL_A).size());
    }

    @Test
    void eventOlderThanWindowIsNotInSnapshot() {
        cache.put(event("e1", CELL_A));
        clock.advance(Duration.ofMinutes(WINDOW_MINUTES + 1));

        assertTrue(cache.snapshot().isEmpty());
    }

    @Test
    void cellWithoutFreshEventsDisappearsFromSnapshot() {
        cache.put(event("old", CELL_A));
        clock.advance(Duration.ofMinutes(WINDOW_MINUTES + 1));
        cache.put(event("new", CELL_B));

        Map<String, List<EnrichedEvent>> snapshot = cache.snapshot();

        assertNull(snapshot.get(CELL_A));
        assertEquals(1, snapshot.get(CELL_B).size());
    }

    @Test
    void newestEventComesFirst() {
        cache.put(event("e1", CELL_A));
        cache.put(event("e2", CELL_A));

        List<EnrichedEvent> events = cache.snapshot().get(CELL_A);

        assertEquals("e2", events.get(0).eventId());
        assertEquals("e1", events.get(1).eventId());
    }

    @Test
    void snapshotIsImmutable() {
        cache.put(event("e1", CELL_A));
        Map<String, List<EnrichedEvent>> snapshot = cache.snapshot();

        assertThrows(UnsupportedOperationException.class,
                () -> snapshot.get(CELL_A).add(event("e2", CELL_A)));
        assertThrows(UnsupportedOperationException.class,
                () -> snapshot.remove(CELL_A));
    }

    @Test
    void evictRemovesExpiredAndKeepsFresh() {
        cache.put(event("old", CELL_A));
        clock.advance(Duration.ofMinutes(WINDOW_MINUTES + 1));
        cache.put(event("new", CELL_A));

        cache.evictExpired();

        List<EnrichedEvent> events = cache.snapshot().get(CELL_A);
        assertEquals(1, events.size());
        assertEquals("new", events.get(0).eventId());
    }

    @Test
    void snapshotSurvivesConcurrentWrites() throws Exception {
        CountDownLatch started = new CountDownLatch(1);
        AtomicReference<Throwable> failure = new AtomicReference<>();

        Thread writer = new Thread(() -> {
            started.countDown();
            for (int i = 0; i < 5_000; i++) {
                cache.put(event("e" + i, i % 2 == 0 ? CELL_A : CELL_B));
            }
        });
        writer.start();
        assertTrue(started.await(1, TimeUnit.SECONDS));

        try {
            for (int i = 0; i < 200; i++) {
                cache.snapshot();
            }
        } catch (Throwable t) {
            failure.set(t);
        }
        writer.join(5_000);

        assertNull(failure.get());
        assertFalse(cache.snapshot().isEmpty());
    }

    private EnrichedEvent event(String id, String cell) {
        return new EnrichedEvent(
                rowIndex.incrementAndGet(),
                id,
                "Заголовок " + id,
                "https://example.org/" + id,
                cell,
                clock.millis() / 1000);
    }

    /** Часы, которые можно двигать руками — иначе окно не проверить без sleep. */
    private static final class MutableClock extends Clock {
        private Instant now;

        private MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
