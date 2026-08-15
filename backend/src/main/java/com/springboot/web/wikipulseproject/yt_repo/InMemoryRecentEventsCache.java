package com.springboot.web.wikipulseproject.yt_repo;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.springboot.web.wikipulseproject.model.EnrichedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.TimeUnit;

@Component
@Slf4j
public class InMemoryRecentEventsCache implements RecentEventsCache {

    /** Ключ — H3-индекс уровня 9 как пришёл из очереди. Порядок в деке — порядок прихода. */
    private final ConcurrentHashMap<String, Deque<EnrichedEvent>> cells = new ConcurrentHashMap<>();

    /** Идентификаторы виденных событий, сами истекают по окну. */
    private final Cache<String, Boolean> seen;

    /** Насколько часы источника могут убежать вперёд, прежде чем событие отбросим. */
    private static final long CLOCK_SKEW_SECONDS = 60;

    private final Clock clock;
    private final long windowSeconds;

    public InMemoryRecentEventsCache(Clock clock,
                                     @Value("${app.live.window-minutes:30}") long windowMinutes) {
        this.clock = clock;
        this.windowSeconds = TimeUnit.MINUTES.toSeconds(windowMinutes);
        this.seen = Caffeine.newBuilder()
                .expireAfterWrite(windowMinutes, TimeUnit.MINUTES)
                .build();
    }

    @Override
    public void put(EnrichedEvent event) {

        if (!hasUsableTime(event)) return;

        if(seen.getIfPresent(event.eventId()) != null) return;
        seen.put(event.eventId(), Boolean.TRUE);

        cells.computeIfAbsent(event.h3R9(),
            k -> new ConcurrentLinkedDeque<>()
         ).addFirst(event);
    }

    /**
     * Событие без пригодного времени в кэш не кладём: по нему нельзя посчитать
     * окно, и оно либо не покажется никогда, либо не протухнет никогда.
     */
    private boolean hasUsableTime(EnrichedEvent event) {
        if (event.eventTs() <= 0) {
            log.warn("событие без времени правки, пропускаю: {}", event.eventId());
            return false;
        }
        long now = clock.instant().getEpochSecond();
        if (event.eventTs() > now + CLOCK_SKEW_SECONDS) {
            log.warn("событие из будущего ({} против {}), пропускаю: {}",
                    event.eventTs(), now, event.eventId());
            return false;
        }
        return true;
    }

    @Override
    public Map<String, List<EnrichedEvent>> snapshot() {
        Map<String, List<EnrichedEvent>> snapShot = new HashMap<>();
        long cutoff = clock.instant().getEpochSecond() - windowSeconds;

        for(Map.Entry<String,Deque<EnrichedEvent>> entry : cells.entrySet()){
            String h3_r9 = entry.getKey();
            Deque<EnrichedEvent> deque = entry.getValue();

            List<EnrichedEvent> list = new ArrayList<>();
            for (EnrichedEvent event : deque) {
                if (event.eventTs() <= cutoff) continue;
                list.add(event);
            }
            if(list.isEmpty()) continue;
            list.sort(Comparator.comparingLong(EnrichedEvent::eventTs).reversed());
            snapShot.put(h3_r9, List.copyOf(list));
        }
        return Map.copyOf(snapShot);
    }

    /** Пустые ячейки из мапы не удаляются: их отсеивает snapshot. */
    @Scheduled(fixedDelay = 60_000)
    void evictExpired() {
        long cutoff = clock.instant().getEpochSecond() - windowSeconds;

        for (Deque<EnrichedEvent> deque : cells.values()) {
            deque.removeIf(event -> event.eventTs() <= cutoff);
        }
    }
}
