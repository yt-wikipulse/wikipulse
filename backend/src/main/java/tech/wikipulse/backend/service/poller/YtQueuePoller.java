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

import java.util.HashMap;
import java.util.Map;

/**
 * Единственный писатель {@link RecentEventsCache} на профиле {@code yt}:
 * вычитывает очередь {@code q_enriched} через консьюмера и укладывает
 * события в кэш живой карты.
 */
@Component
@Profile("yt")
@Slf4j
public class YtQueuePoller {

    private final QEnrichedRepository repository;
    private final RecentEventsCache cache;
    private final int maxPagesPerTick;

    /**
     * Оффсеты партиций очереди; {@code null} означает, что поллер ещё
     * не стартовал и первый тик уйдёт на чтение позиции из консьюмера.
     */
    private Map<Integer, Long> offsets = null;
    private int partitions = 0;

    /**
     * Сколько тиков подряд не удалось прочитать очередь. Первые четыре
     * логируются как {@code warn}, дальше как {@code error}: при интервале
     * в полсекунды моргнувший кластер не повод для тревоги, а полминуты
     * недоступности — повод.
     */
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
                log.error("YT недоступен {} тиков подряд, оффсеты={}", ytFailStreak, offsets, e);
            } else {
                log.warn("не прочитал порцию из очереди, оффсеты={}", offsets, e);
            }
        } catch (RuntimeException e) {
            log.error("баг в поллере, оффсеты={}", offsets, e);
        }
    }

    /**
     * Один проход по всем партициям очереди, не более
     * {@code maxPagesPerTick} страниц на каждую.
     *
     * <p>Первый тик после старта поднимает позицию из консьюмера, а не
     * перематывает очередь в конец: рестарт продолжает чтение оттуда, где
     * оно прервалось, и окно кэша набирается сразу, а не за тридцать минут.
     * На пустом консьюмере чтение начинается с начала очереди — догон идёт
     * порциями по тику и упирается в окно кэша, которое выбросит всё
     * старое само.
     *
     * <p>Консьюмер двигается в {@code finally}: страница, на которой упала
     * укладка, теряет битые события, но не встаёт навсегда. Ошибка самого
     * чтения ({@link YtReadException}) вылетает до {@code finally}, позиция
     * остаётся на месте и следующий тик перечитает ту же порцию.
     */
    private void tick() {
        if (offsets == null) {
            partitions = repository.partitionCount();
            offsets = new HashMap<>(repository.committedOffsets());
            log.info("поллер стартовал: партиций {}, оффсеты {}", partitions, offsets);
        }

        for (int partition = 0; partition < partitions; partition++) {
            readPartition(partition);
        }
    }

    private void readPartition(int partition) {
        long offset = offsets.getOrDefault(partition, 0L);
        int pages = 0;
        QEnrichedRepository.EventsPage page;

        do {
            page = repository.pull(partition, offset, repository.batchSize());
            if (page.events().isEmpty()) {
                return;
            }

            try {
                for (EnrichedEvent event : page.events()) {
                    consume(event);
                }
            } finally {
                repository.advance(partition, offset, page.nextOffset());
                offset = page.nextOffset();
                offsets.put(partition, offset);
            }
            pages++;

        } while (page.hasMore() && pages < maxPagesPerTick);
    }

    /**
     * Кладёт событие в кэш. Отдельное событие не должно ронять всю порцию,
     * поэтому ошибка укладки только считается в {@code droppedEvents}
     * и пишется в лог.
     */
    private void consume(EnrichedEvent event) {
        try {
            cache.put(event);
        } catch (RuntimeException e) {
            droppedEvents++;
            log.warn("событие отброшено, всего отброшено={}, строка={}", droppedEvents, event.rowIndex(), e);
        }
    }
}
