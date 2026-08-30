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

/**
 * Единственный писатель {@link RecentEventsCache} на профиле {@code yt}:
 * вычитывает очередь {@code q_enriched} страницами и укладывает события в кэш
 * живой карты.
 */
@Component
@Profile("yt")
@Slf4j
public class YtQueuePoller {

    private final QEnrichedRepository repository;
    private final RecentEventsCache cache;
    private final int maxPagesPerTick;

    /**
     * Позиция в очереди; {@code null} означает, что поллер ещё не стартовал
     * и первый тик уйдёт на перемотку в конец.
     */
    private Long lastSeenRowIndex = null;

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
                log.error("YT недоступен {} тиков подряд, курсор={}", ytFailStreak, lastSeenRowIndex, e);
            } else {
                log.warn("не прочитал порцию из очереди, курсор={}", lastSeenRowIndex, e);
            }
        } catch (RuntimeException e) {
            log.error("баг в поллере, курсор={}", lastSeenRowIndex, e);
        }
    }

    /**
     * Один проход по очереди: не более {@code maxPagesPerTick} страниц.
     *
     * <p>Первый тик после старта ничего не читает в кэш, а ставит курсор
     * в конец очереди: истории бэкенду не нужно (окно кэша — 30 минут),
     * а чтение живой очереди с начала означало бы миллионы строк в память
     * одной пачкой. Следствие — после рестарта полное окно набирается
     * только через 30 минут.
     *
     * <p>Курсор двигается в {@code finally}: страница, на которой упала
     * укладка, теряет битые события, но не встаёт навсегда. Ошибка самого
     * чтения ({@link YtReadException}) вылетает до {@code finally}, курсор
     * остаётся на месте и следующий тик перечитает ту же порцию.
     */
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
