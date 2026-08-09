package com.springboot.web.wikipulseproject.yt_repo;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.springboot.web.wikipulseproject.model.EnrichedEvent;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.TimeUnit;

@Component
public class InMemoryRecentEventsCache implements RecentEventsCache {

    /** Ключ — H3-индекс уровня 9 как пришёл из очереди. Новые события в голове. */
    private final ConcurrentHashMap<String, Deque<TimedEvent>> cells = new ConcurrentHashMap<>();

    /** Идентификаторы виденных событий, сами истекают по окну. */
    private final Cache<String, Boolean> seen;

    private final Clock clock;
    private final long windowMillis;

    public InMemoryRecentEventsCache(Clock clock,
                                     @Value("${app.live.window-minutes:30}") long windowMinutes) {
        this.clock = clock;
        this.windowMillis = TimeUnit.MINUTES.toMillis(windowMinutes);
        this.seen = Caffeine.newBuilder()
                .expireAfterWrite(windowMinutes, TimeUnit.MINUTES)
                .build();
    }

    @Override
    public void put(EnrichedEvent event) {

        if(seen.getIfPresent(event.eventId()) != null) return;
        seen.put(event.eventId(), Boolean.TRUE);

        cells.computeIfAbsent(event.h3_r9(),
            k -> new ConcurrentLinkedDeque<>()
         ).addFirst(new TimedEvent(event, clock.millis() ));
    }

    @Override
    public Map<String, List<EnrichedEvent>> snapshot() {
        Map<String, List<EnrichedEvent>> snapShot = new HashMap<>();
        long cutoff = clock.millis() - windowMillis;

        for(Map.Entry<String,Deque<TimedEvent>> entry : cells.entrySet()){
            String h3_r9 = entry.getKey();
            Deque<TimedEvent> deque = entry.getValue();

            List<EnrichedEvent> list = new ArrayList<>();
            for (TimedEvent te : deque) {
                if (te.addedAtMillis() <= cutoff) break;
                list.add(te.event());
            }
            if(list.isEmpty()) continue;
            snapShot.put(h3_r9, List.copyOf(list));
        }
        return Map.copyOf(snapShot);
    }

    /** Пустые ячейки из мапы не удаляются: их отсеивает snapshot. */
    @Scheduled(fixedDelay = 60_000)
    void evictExpired() {
        long cutoff = clock.millis() - windowMillis;

        for (Deque<TimedEvent> deque : cells.values()) {
            TimedEvent tail;
            while ((tail = deque.peekLast()) != null && tail.addedAtMillis() <= cutoff) {
                deque.pollLast();
            }
        }
    }
}
