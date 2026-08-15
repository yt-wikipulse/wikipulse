package com.springboot.web.wikipulseproject.yt_repo;

import com.springboot.web.wikipulseproject.error.YtReadException;
import com.springboot.web.wikipulseproject.model.EnrichedEvent;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
import tech.ytsaurus.client.ApiServiceTransaction;
import tech.ytsaurus.client.YTsaurusClient;
import tech.ytsaurus.client.request.SelectRowsRequest;
import tech.ytsaurus.client.request.StartTransaction;
import tech.ytsaurus.client.request.TransactionType;
import tech.ytsaurus.client.rows.UnversionedRowset;
import tech.ytsaurus.client.rpc.YTsaurusClientAuth;
import tech.ytsaurus.ysontree.YTreeNode;
import tech.ytsaurus.ysontree.YTreeMapNode;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Repository
@Profile("yt")
public class QEnrichedRepository {

    public record EventsPage(List<EnrichedEvent> events, long lastRowIndex, boolean hasMore) {}

    private static final int ABSOLUTE_MAX_BATCH = 10_000;
    private static final int DEFAULT_BATCH = 1_000;
    private static final long START = -1L;
    private static final String ROW_INDEX_OUT = "$$row_index";

    private final YTsaurusClient client;
    private final String tablePath;
    private final int maxBatchSize;

    public QEnrichedRepository(
            @Value("${yt.proxy}") String proxy,
            @Value("${yt.token}") String token,
            @Value("${yt.table.q_enriched}") String tablePath,
            @Value("${app.enrich.fetch-batch:1000}") int maxBatchSize) {
        this.client = YTsaurusClient.builder()
                .setCluster(proxy)
                .setAuth(YTsaurusClientAuth.builder().setToken(token).build())
                .build();
        this.tablePath = tablePath;
        this.maxBatchSize = clamp(maxBatchSize);
    }

    public EventsPage fetchAfter(long lastSeenRowIndex) {
        return fetchAfter(lastSeenRowIndex, DEFAULT_BATCH);
    }

    public EventsPage fetchAfter(long lastSeenRowIndex, int requestedLimit) {
        final int limit = Math.min(clamp(requestedLimit), maxBatchSize);
        final int fetch = limit + 1;

        String predicate = lastSeenRowIndex >= 0
                ? "[$tablet_index] = 0 AND [$row_index] > " + lastSeenRowIndex
                : "[$tablet_index] = 0";

        String query = "* FROM [" + tablePath + "] WHERE " + predicate
                + " LIMIT " + fetch;

        try (ApiServiceTransaction tx = client
                .startTransaction(new StartTransaction(TransactionType.Master))
                .join()) {
            UnversionedRowset rowset =
                    tx.selectRows(SelectRowsRequest.of(query)).join();
            List<YTreeMapNode> rows = rowset.getYTreeRows();

            boolean hasMore = rows.size() > limit;
            List<EnrichedEvent> events = new ArrayList<>(Math.min(rows.size(), limit));
            long maxIdx = lastSeenRowIndex;

            for (int i = 0; i < rows.size() && i < limit; i++) {
                YTreeMapNode r = rows.get(i);
                long idx = r.get(ROW_INDEX_OUT)
                        .map(YTreeNode::longValue)
                        .orElse(lastSeenRowIndex + i + 1L);
                maxIdx = Math.max(maxIdx, idx);
                events.add(new EnrichedEvent(
                        idx,
                        r.getStringO("event_id").orElse(null),
                        r.getStringO("title").orElse(null),
                        r.getStringO("url").orElse(null),
                        r.getStringO("h3_r9").orElse(null),
                        r.get("event_ts").map(YTreeNode::longValue).orElse(0L)));
            }

            return new EventsPage(Collections.unmodifiableList(events), maxIdx, hasMore);
        } catch (RuntimeException e) {
            throw new YtReadException(
                    "q_enriched fetch failed (cursor=" + lastSeenRowIndex
                            + ", limit=" + limit + "): " + e.getMessage(), e);
        }
    }

    public long skipToLatest() {
        EventsPage page = fetchAfter(START, maxBatchSize);
        while (page.hasMore()) {
            page = fetchAfter(page.lastRowIndex(), maxBatchSize);
        }
        return page.lastRowIndex();
    }

    private static int clamp(int v) {
        return Math.max(1, Math.min(v, ABSOLUTE_MAX_BATCH));
    }
}
