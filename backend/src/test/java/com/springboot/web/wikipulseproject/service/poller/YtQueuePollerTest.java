package com.springboot.web.wikipulseproject.service.poller;

import com.springboot.web.wikipulseproject.error.YtReadException;
import com.springboot.web.wikipulseproject.model.EnrichedEvent;
import com.springboot.web.wikipulseproject.yt_repo.QEnrichedRepository;
import com.springboot.web.wikipulseproject.yt_repo.RecentEventsCache;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class YtQueuePollerTest {

    private static final int MAX_PAGES = 3;

    @Mock
    private QEnrichedRepository repository;

    @Mock
    private RecentEventsCache cache;

    private YtQueuePoller poller;

    @BeforeEach
    void setUp() {
        poller = new YtQueuePoller(repository, cache, MAX_PAGES);
    }

    @Test
    void firstTickOnlyLearnsQueueTail() {
        when(repository.skipToLatest()).thenReturn(100L);

        poller.writeCache();

        verify(repository).skipToLatest();
        verify(repository, never()).fetchAfter(anyLong());
        verify(cache, never()).put(any());
    }

    @Test
    void secondTickReadsFromLearnedTail() {
        when(repository.skipToLatest()).thenReturn(100L);
        when(repository.fetchAfter(100L)).thenReturn(page(List.of(), 100L, false));

        poller.writeCache();
        poller.writeCache();

        verify(repository, times(1)).skipToLatest();
        verify(repository).fetchAfter(100L);
    }

    @Test
    void cursorAdvancesToReturnedIndexNotByBatchSize() {
        when(repository.skipToLatest()).thenReturn(0L);
        when(repository.fetchAfter(0L))
                .thenReturn(page(List.of(event(1), event(2)), 57L, false));
        when(repository.fetchAfter(57L)).thenReturn(page(List.of(), 57L, false));

        poller.writeCache();
        poller.writeCache();
        poller.writeCache();

        verify(repository).fetchAfter(57L);
        verify(repository, never()).fetchAfter(2L);
    }

    @Test
    void pagesAreDrainedWhileMoreAvailable() {
        when(repository.skipToLatest()).thenReturn(0L);
        when(repository.fetchAfter(0L)).thenReturn(page(List.of(event(1)), 10L, true));
        when(repository.fetchAfter(10L)).thenReturn(page(List.of(event(2)), 20L, false));

        poller.writeCache();
        poller.writeCache();

        verify(repository, times(2)).fetchAfter(anyLong());
        verify(cache, times(2)).put(any(EnrichedEvent.class));
    }

    @Test
    void oneTickReadsNoMoreThanPageLimit() {
        when(repository.skipToLatest()).thenReturn(0L);
        when(repository.fetchAfter(anyLong())).thenAnswer(call -> {
            long from = call.getArgument(0);
            return page(List.of(event(1)), from + 10, true);
        });

        poller.writeCache();
        poller.writeCache();

        verify(repository, times(MAX_PAGES)).fetchAfter(anyLong());
    }

    @Test
    void polledEventsGoToCache() {
        when(repository.skipToLatest()).thenReturn(0L);
        when(repository.fetchAfter(0L))
                .thenReturn(page(List.of(event(1), event(2)), 5L, false));

        poller.writeCache();
        poller.writeCache();

        verify(cache, times(2)).put(any(EnrichedEvent.class));
    }

    @Test
    void ytFailureDoesNotBreakTick() {
        when(repository.skipToLatest())
                .thenThrow(new YtReadException("YT недоступен", new RuntimeException()));

        assertDoesNotThrow(() -> poller.writeCache());
        verify(cache, never()).put(any());
    }

    @Test
    void unexpectedFailureDoesNotBreakTick() {
        when(repository.skipToLatest()).thenThrow(new IllegalStateException("баг"));

        assertDoesNotThrow(() -> poller.writeCache());
        verify(cache, never()).put(any());
    }

    @Test
    void cursorSurvivesFailedTick() {
        when(repository.skipToLatest()).thenReturn(100L);
        when(repository.fetchAfter(100L))
                .thenThrow(new YtReadException("сеть моргнула", new RuntimeException()))
                .thenReturn(page(List.of(event(1)), 110L, false));

        poller.writeCache();
        poller.writeCache();
        poller.writeCache();

        verify(repository, times(1)).skipToLatest();
        verify(repository, times(2)).fetchAfter(100L);
        verify(cache, times(1)).put(any(EnrichedEvent.class));
    }

    private QEnrichedRepository.EventsPage page(List<EnrichedEvent> events,
                                                long lastRowIndex,
                                                boolean hasMore) {
        return new QEnrichedRepository.EventsPage(events, lastRowIndex, hasMore);
    }

    private EnrichedEvent event(long rowIndex) {
        return new EnrichedEvent(
            rowIndex,
            "e" + rowIndex,
            "Заголовок " + rowIndex,
            "https://example.org/" + rowIndex,
            "8928308280fffff",
            1_760_000_000L,
            100L + rowIndex,                              // НОВОЕ: lengthUpdate
            "https://example.org/diff/" + rowIndex);      // НОВОЕ: diffUrl
    }
}
