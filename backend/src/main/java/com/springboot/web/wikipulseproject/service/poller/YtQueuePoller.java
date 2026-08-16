package com.springboot.web.wikipulseproject.service.poller;

import com.springboot.web.wikipulseproject.error.YtReadException;
import com.springboot.web.wikipulseproject.model.EnrichedEvent;
import com.springboot.web.wikipulseproject.yt_repo.QEnrichedRepository;
import com.springboot.web.wikipulseproject.yt_repo.RecentEventsCache;
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

    public YtQueuePoller(QEnrichedRepository repository,
                         RecentEventsCache cache,
                         @Value("${app.poller.max-pages-per-tick:10}") int maxPagesPerTick) {
        this.repository = repository;
        this.cache = cache;
        this.maxPagesPerTick = maxPagesPerTick;
    }

    @Scheduled(fixedDelayString = "${app.poller.interval-ms:500}")
    void writeCache() {
        try {
            tick();
            ytFailStreak = 0;//успех - сбросили серию
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

    //один тик: страница едет в кэш до сдвига курсора
    private void tick() {
        if (lastSeenRowIndex == null) {
            lastSeenRowIndex = repository.skipToLatest();
            return;
        }

        int pages = 0;
        QEnrichedRepository.EventsPage page;

        do {
            page = repository.fetchAfter(lastSeenRowIndex);

            for (EnrichedEvent event : page.events()) {
                cache.put(event);
            }

            lastSeenRowIndex = page.lastRowIndex();
            pages++;

        } while (page.hasMore() && pages < maxPagesPerTick);
    }
}
