package tech.wikipulse.backend.service.poller;

import tech.wikipulse.backend.error.YtReadException;
import tech.wikipulse.backend.model.EnrichedEvent;
import tech.wikipulse.backend.repository.QEnrichedRepository;
import tech.wikipulse.backend.repository.RecentEventsCache;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("yt")
@Slf4j
public class YtQueuePoller {

    private final QEnrichedRepository repository;
    private final RecentEventsCache cache;
    private final int maxPagesPerTick;

    private Long lastSeenRowIndex = null;
    private int ytFailStreak = 0;
    private long droppedEvents = 0;

    public YtQueuePoller(QEnrichedRepository repository,
                         RecentEventsCache cache,
                         @Value("${app.poller.max-pages-per-tick:10}") int maxPagesPerTick) {
        this.repository = repository;
        this.cache = cache;
        this.maxPagesPerTick = maxPagesPerTick;
    }

    long droppedEvents() {
        return droppedEvents;
    }

    @Scheduled(fixedDelayString = "${app.poller.interval-ms:500}")
    void writeCache() {
        try {
            tick();
            ytFailStreak = 0;
        } catch (YtReadException e) {
            ytFailStreak++;
            if (ytFailStreak >= 5) {
                log.error("YT недоступен {} тиков подряд, курсор={}", ytFailStreak, lastSeenRowIndex, e);
            } else {
                log.warn("не прочитал порцию из очереди, курсор={}", lastSeenRowIndex, e);
            }
        } catch (RuntimeException e) {
            log.error("баг в поллере, курсор={}", lastSeenRowIndex, e);
        }
    }

    private void tick() {
        if (lastSeenRowIndex == null) {
            lastSeenRowIndex = repository.skipToLatest();
            return;
        }

        int pages = 0;
        QEnrichedRepository.EventsPage page;

        do {
            page = repository.fetchAfter(lastSeenRowIndex);

            try {
                for (EnrichedEvent event : page.events()) {
                    consume(event);
                }
            } finally {
                lastSeenRowIndex = page.lastRowIndex();
            }
            pages++;

        } while (page.hasMore() && pages < maxPagesPerTick);
    }

    private void consume(EnrichedEvent event) {
        try {
            cache.put(event);
        } catch (RuntimeException e) {
            droppedEvents++;
            log.warn("событие отброшено, всего отброшено={}, строка={}", droppedEvents, event.rowIndex(), e);
        }
    }
}
