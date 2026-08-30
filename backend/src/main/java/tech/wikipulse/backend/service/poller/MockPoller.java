package tech.wikipulse.backend.service.poller;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import tech.wikipulse.backend.model.EnrichedEvent;
import tech.wikipulse.backend.repository.RecentEventsCache;
import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Замена {@link YtQueuePoller} на профиле {@code mock}: вместо очереди YTsaurus
 * проигрывает по кругу фикстуру настоящих правок Википедии, снятых с боевого стенда.
 * Гексагоны в фикстуре настоящие — получены соединением со справочником координат,
 * поэтому карта на этом профиле показывает правки там, где они действительно были.
 */
@Component
@Profile("mock")
public class MockPoller {

    private static final String EDITS_FIXTURE = "fixtures/q_enriched-sample.json";

    private record SampleEdit(String eventId, String title, String url, String h3R9,
                              long eventTs, long lengthUpdate, String diffUrl) {}

    private final RecentEventsCache cache;
    private final Clock clock;
    private final List<EnrichedEvent> sample;
    private final long sampleEndTs;
    private final AtomicInteger cursor = new AtomicInteger();

    public MockPoller(RecentEventsCache cache, Clock clock, ObjectMapper mapper) {
        this.cache = cache;
        this.clock = clock;
        this.sample = buildSample(mapper);
        this.sampleEndTs = sample.stream().mapToLong(EnrichedEvent::eventTs).max().orElse(0L);
    }

    /**
     * Наполняет кэш при старте, сдвигая времена фикстуры в текущее окно:
     * иначе снятые в прошлом события сразу окажутся протухшими и карта будет пустой.
     */
    @PostConstruct
    void backfill() {
        long shift = clock.instant().getEpochSecond() - sampleEndTs;
        for (int i = 0; i < sample.size(); i++) {
            cache.put(replay(i, sample.get(i).eventTs() + shift, 0));
        }
    }

    @Scheduled(fixedDelay = 2_000)
    void emit() {
        int next = cursor.getAndIncrement();
        cache.put(replay(next % sample.size(), clock.instant().getEpochSecond(), next / sample.size() + 1));
    }

    /**
     * На втором и последующих проходах к идентификатору дописывается номер прохода:
     * кэш дедуплицирует события по {@code event_id}, и без этого повтор не попал бы внутрь.
     */
    private EnrichedEvent replay(int index, long eventTs, int pass) {
        EnrichedEvent origin = sample.get(index);
        return new EnrichedEvent(
            index,
            pass == 0 ? origin.eventId() : origin.eventId() + "#" + pass,
            origin.title(),
            origin.url(),
            origin.h3R9(),
            eventTs,
            origin.lengthUpdate(),
            origin.diffUrl());
    }

    private static List<EnrichedEvent> buildSample(ObjectMapper mapper) {
        List<SampleEdit> edits = read(mapper, EDITS_FIXTURE, new TypeReference<List<SampleEdit>>() {});

        List<EnrichedEvent> events = new ArrayList<>(edits.size());
        for (int i = 0; i < edits.size(); i++) {
            SampleEdit edit = edits.get(i);
            events.add(new EnrichedEvent(
                i,
                edit.eventId(),
                edit.title(),
                edit.url(),
                edit.h3R9(),
                edit.eventTs(),
                edit.lengthUpdate(),
                edit.diffUrl()));
        }
        return List.copyOf(events);
    }

    private static <T> T read(ObjectMapper mapper, String path, TypeReference<T> type) {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return mapper.readValue(in, type);
        } catch (IOException e) {
            throw new UncheckedIOException(path + " is not readable", e);
        }
    }
}
