package tech.wikipulse.backend.service.poller;

import tech.wikipulse.backend.error.YtReadException;
import tech.wikipulse.backend.model.EnrichedEvent;
import tech.wikipulse.backend.repository.QEnrichedRepository;
import tech.wikipulse.backend.repository.RecentEventsCache;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class YtQueuePollerTest {

    private static final int MAX_PAGES = 3;
    private static final int BATCH = 1_000;

    @Mock
    private QEnrichedRepository repository;

    @Mock
    private RecentEventsCache cache;

    private YtQueuePoller poller;

    @BeforeEach
    void setUp() {
        poller = new YtQueuePoller(repository, cache, MAX_PAGES);
        lenient().when(repository.batchSize()).thenReturn(BATCH);
    }

    private void queue(int partitions, Map<Integer, Long> offsets) {
        when(repository.partitionCount()).thenReturn(partitions);
        when(repository.committedOffsets()).thenReturn(offsets);
    }

    @Test
    void firstTickReadsFromCommittedOffset() {
        queue(1, Map.of(0, 100L));
        when(repository.pull(0, 100L, BATCH)).thenReturn(page(List.of(event(100)), 101L, false));

        poller.writeCache();

        verify(repository).pull(0, 100L, BATCH);
        verify(cache).put(any(EnrichedEvent.class));
    }

    @Test
    void emptyConsumerStartsFromQueueHead() {
        queue(1, Map.of());
        when(repository.pull(0, 0L, BATCH)).thenReturn(page(List.of(), 0L, false));

        poller.writeCache();

        verify(repository).pull(0, 0L, BATCH);
    }

    @Test
    void queuePositionIsReadOnlyOnce() {
        queue(1, Map.of(0, 100L));
        when(repository.pull(anyInt(), anyLong(), anyInt()))
                .thenReturn(page(List.of(), 100L, false));

        poller.writeCache();
        poller.writeCache();

        verify(repository, times(1)).partitionCount();
        verify(repository, times(1)).committedOffsets();
    }

    @Test
    void consumerAdvancesToReturnedOffsetNotByBatchSize() {
        queue(1, Map.of(0, 0L));
        when(repository.pull(0, 0L, BATCH))
                .thenReturn(page(List.of(event(1), event(2)), 57L, false));
        when(repository.pull(0, 57L, BATCH)).thenReturn(page(List.of(), 57L, false));

        poller.writeCache();
        poller.writeCache();

        verify(repository).advance(0, 0L, 57L);
        verify(repository).pull(0, 57L, BATCH);
        verify(repository, never()).pull(0, 2L, BATCH);
    }

    @Test
    void everyPartitionIsRead() {
        queue(3, Map.of(0, 10L, 1, 20L));
        when(repository.pull(anyInt(), anyLong(), anyInt()))
                .thenReturn(page(List.of(), 0L, false));

        poller.writeCache();

        verify(repository).pull(0, 10L, BATCH);
        verify(repository).pull(1, 20L, BATCH);
        verify(repository).pull(2, 0L, BATCH);
    }

    @Test
    void pagesAreDrainedWhileMoreAvailable() {
        queue(1, Map.of(0, 0L));
        when(repository.pull(0, 0L, BATCH)).thenReturn(page(List.of(event(1)), 10L, true));
        when(repository.pull(0, 10L, BATCH)).thenReturn(page(List.of(event(2)), 20L, false));

        poller.writeCache();

        verify(repository, times(2)).pull(anyInt(), anyLong(), anyInt());
        verify(cache, times(2)).put(any(EnrichedEvent.class));
    }

    @Test
    void oneTickReadsNoMoreThanPageLimit() {
        queue(1, Map.of(0, 0L));
        when(repository.pull(anyInt(), anyLong(), anyInt())).thenAnswer(call -> {
            long from = call.getArgument(1);
            return page(List.of(event(1)), from + 10, true);
        });

        poller.writeCache();

        verify(repository, times(MAX_PAGES)).pull(anyInt(), anyLong(), anyInt());
    }

    @Test
    void ytFailureDoesNotBreakTick() {
        when(repository.partitionCount())
                .thenThrow(new YtReadException("YT недоступен", new RuntimeException()));

        assertDoesNotThrow(() -> poller.writeCache());
        verify(cache, never()).put(any());
    }

    @Test
    void unexpectedFailureDoesNotBreakTick() {
        when(repository.partitionCount()).thenThrow(new IllegalStateException("баг"));

        assertDoesNotThrow(() -> poller.writeCache());
        verify(cache, never()).put(any());
    }

    @Test
    void positionSurvivesFailedTick() {
        queue(1, Map.of(0, 100L));
        when(repository.pull(0, 100L, BATCH))
                .thenThrow(new YtReadException("сеть моргнула", new RuntimeException()))
                .thenReturn(page(List.of(event(1)), 110L, false));

        poller.writeCache();
        poller.writeCache();

        verify(repository, times(2)).pull(0, 100L, BATCH);
        verify(cache, times(1)).put(any(EnrichedEvent.class));
    }

    @Test
    void brokenEventDoesNotStallConsumer() {
        queue(1, Map.of(0, 0L));
        when(repository.pull(0, 0L, BATCH))
                .thenReturn(page(List.of(event(1), event(2)), 42L, false));
        when(repository.pull(0, 42L, BATCH)).thenReturn(page(List.of(), 42L, false));
        doThrow(new IllegalStateException("битая строка")).when(cache).put(any());

        poller.writeCache();
        poller.writeCache();

        assertEquals(2, poller.droppedEvents());
        verify(repository).advance(0, 0L, 42L);
        verify(repository).pull(0, 42L, BATCH);
    }

    private QEnrichedRepository.EventsPage page(List<EnrichedEvent> events,
                                                long nextOffset,
                                                boolean hasMore) {
        return new QEnrichedRepository.EventsPage(events, nextOffset, hasMore);
    }

    private EnrichedEvent event(long rowIndex) {
        return new EnrichedEvent(
            rowIndex,
            "e" + rowIndex,
            "Заголовок " + rowIndex,
            "https://example.org/" + rowIndex,
            "8928308280fffff",
            1_760_000_000L,
            100L + rowIndex,
            "https://example.org/diff/" + rowIndex);
    }
}
