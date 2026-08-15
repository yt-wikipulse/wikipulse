package com.springboot.web.wikipulseproject.service.poller;

import com.springboot.web.wikipulseproject.model.EnrichedEvent;
import com.springboot.web.wikipulseproject.yt_repo.QEnrichedRepository;
import com.springboot.web.wikipulseproject.yt_repo.RecentEventsCache;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
@Profile("yt")
@Slf4j
public class YtQueuePoller {

    private final QEnrichedRepository repository;
    private final RecentEventsCache cache;
    private final int maxPagesPerTick;

    /** Курсор очереди. null — ещё не знаем, где начинать. */
    private Long lastSeenRowIndex = null;

    public YtQueuePoller(QEnrichedRepository repository,
                         RecentEventsCache cache,
                         @Value("${app.poller.max-pages-per-tick:10}") int maxPagesPerTick) {
        this.repository = repository;
        this.cache = cache;
        this.maxPagesPerTick = maxPagesPerTick;
    }

    @Scheduled(fixedDelayString = "${app.poller.interval-ms:2500}")
    void writeCache() {
        try {
            for (EnrichedEvent event : poll()) {
                cache.put(event);
            }
        } catch (RuntimeException e) {
            log.warn("не прочитал порцию из очереди, курсор={}", lastSeenRowIndex, e);
        }
    }

    List<EnrichedEvent> poll() {
        List<EnrichedEvent> polled = new ArrayList<>();

        if (lastSeenRowIndex == null) {
            lastSeenRowIndex = repository.skipToLatest();
        }

        QEnrichedRepository.EventsPage page;
        int pages = 0;
        do {
            page = repository.fetchAfter(lastSeenRowIndex);
            lastSeenRowIndex = page.lastRowIndex();
            polled.addAll(page.events());
            pages++;
        } while (page.hasMore() && pages < maxPagesPerTick);

        return polled;
    }
}
