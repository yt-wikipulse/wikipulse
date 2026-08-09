package com.springboot.web.wikipulseproject.service.poller;

import com.springboot.web.wikipulseproject.model.EnrichedEvent;
import com.springboot.web.wikipulseproject.yt_repo.InMemoryRecentEventsCache;
import com.uber.h3core.H3Core;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.time.Clock;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MockPollerTest {

    private H3Core h3;
    private InMemoryRecentEventsCache cache;
    private MockPoller poller;

    @BeforeEach
    void setUp() throws IOException {
        h3 = H3Core.newInstance();
        cache = new InMemoryRecentEventsCache(Clock.systemUTC(), 30);
        poller = new MockPoller(cache, h3);
    }

    @Test
    void события_попадают_в_кэш() {
        poller.emit();

        assertFalse(cache.snapshot().isEmpty());
    }

    @Test
    void ключи_ячеек_валидные_h3_девятого_уровня() {
        for (int i = 0; i < 50; i++) {
            poller.emit();
        }

        for (String key : cache.snapshot().keySet()) {
            assertTrue(h3.isValidCell(key), "невалидный H3-индекс: " + key);
            assertEquals(9, h3.getResolution(key), "не девятый уровень: " + key);
        }
    }

    @Test
    void идентификаторы_не_повторяются_и_дедупликация_не_срезает_события() {
        int emitted = 200;
        for (int i = 0; i < emitted; i++) {
            poller.emit();
        }

        long stored = cache.snapshot().values().stream().mapToLong(List::size).sum();

        assertEquals(emitted, stored);
    }

    @Test
    void события_ложатся_больше_чем_в_одну_ячейку() {
        for (int i = 0; i < 200; i++) {
            poller.emit();
        }

        Map<String, List<EnrichedEvent>> snapshot = cache.snapshot();

        assertTrue(snapshot.size() > 1, "все события попали в одну ячейку: " + snapshot.keySet());
    }
}
