package tech.wikipulse.backend.repository;

import tech.wikipulse.backend.error.YtReadException;
import tech.wikipulse.backend.model.EnrichedEvent;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
import tech.ytsaurus.client.ApiServiceTransaction;
import tech.ytsaurus.client.YTsaurusClient;
import tech.ytsaurus.client.request.AdvanceConsumer;
import tech.ytsaurus.client.request.PullConsumer;
import tech.ytsaurus.client.request.RowBatchReadOptions;
import tech.ytsaurus.client.request.SelectRowsRequest;
import tech.ytsaurus.client.request.StartTransaction;
import tech.ytsaurus.client.request.TransactionType;
import tech.ytsaurus.client.rows.QueueRowset;
import tech.ytsaurus.client.rows.UnversionedRowset;
import tech.ytsaurus.client.rpc.YTsaurusClientAuth;
import tech.ytsaurus.core.cypress.YPath;
import tech.ytsaurus.ysontree.YTreeNode;
import tech.ytsaurus.ysontree.YTreeMapNode;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Чтение очереди {@code q_enriched} через consumer API YTsaurus.
 *
 * <p>Позиция чтения живёт не в памяти процесса, а в консьюмере
 * {@code c_backend}: строки берутся {@code pull_consumer}, после укладки
 * в кэш консьюмер двигается {@code advance_consumer}. Поэтому рестарт
 * бэкенда продолжает чтение с того места, где оно прервалось.
 *
 * <p>Консьюмер зарегистрирован на очередь как non-vital: живая карта
 * показывает последние полчаса, и её отставание не должно запрещать
 * очереди тримиться. За сохранность данных отвечает vital-консьюмер
 * архиватора.
 */
@Repository
@Profile("yt")
public class QEnrichedRepository {

    /**
     * Страница очереди: события, оффсет первой непрочитанной строки после
     * них и признак того, что за страницей есть ещё.
     */
    public record EventsPage(List<EnrichedEvent> events, long nextOffset, boolean hasMore) {}

    private static final int ABSOLUTE_MAX_BATCH = 10_000;
    private static final int DEFAULT_BATCH = 1_000;

    private final YTsaurusClient client;
    private final YPath queuePath;
    private final YPath consumerPath;
    private final String queuePathString;
    private final int maxBatchSize;

    public QEnrichedRepository(
            @Value("${yt.proxy}") String proxy,
            @Value("${yt.token}") String token,
            @Value("${yt.table.q_enriched}") String tablePath,
            @Value("${yt.consumer.q_enriched}") String consumerPath,
            @Value("${app.enrich.fetch-batch:1000}") int maxBatchSize) {
        this.client = YTsaurusClient.builder()
                .setCluster(YtProxy.withScheme(proxy))
                .setAuth(YTsaurusClientAuth.builder().setToken(token).build())
                .build();
        this.queuePath = YPath.simple(tablePath);
        this.consumerPath = YPath.simple(consumerPath);
        this.queuePathString = tablePath;
        this.maxBatchSize = clamp(maxBatchSize);
    }

    public int batchSize() {
        return maxBatchSize == 0 ? DEFAULT_BATCH : maxBatchSize;
    }

    /**
     * Число партиций очереди — оно же число её таблетов. У каждой партиции
     * своя нумерация строк и свой оффсет в консьюмере, поэтому читать их
     * надо по отдельности.
     */
    public int partitionCount() {
        try {
            return client.getNode(queuePathString + "/@tablet_count").join().intValue();
        } catch (RuntimeException e) {
            throw new YtReadException("не удалось узнать число партиций "
                    + queuePathString + ": " + e.getMessage(), e);
        }
    }

    /**
     * Оффсеты партиций из таблицы консьюмера — индексы первых ещё не
     * прочитанных строк. Партиции, которых в ответе нет, не читались ни разу.
     *
     * <p>Таблица консьюмера маленькая — строка на партицию каждой его
     * очереди, — поэтому читается целиком и фильтруется на месте.
     */
    public Map<Integer, Long> committedOffsets() {
        try {
            UnversionedRowset rowset = client
                    .selectRows(SelectRowsRequest.of("* FROM [" + consumerPath + "]"))
                    .join();

            Map<Integer, Long> offsets = new HashMap<>();
            for (YTreeMapNode row : rowset.getYTreeRows()) {
                if (!queuePathString.equals(row.getStringO("queue_path").orElse(null))) {
                    continue;
                }
                YTreeNode offset = row.getOrThrow("offset");
                if (offset.isEntityNode()) {
                    continue;
                }
                offsets.put((int) row.getOrThrow("partition_index").longValue(),
                        offset.longValue());
            }
            return offsets;
        } catch (RuntimeException e) {
            throw new YtReadException("не удалось прочитать оффсеты консьюмера "
                    + consumerPath + ": " + e.getMessage(), e);
        }
    }

    /**
     * Страница партиции начиная с указанного оффсета.
     *
     * <p>Индексы строк берутся не из служебной колонки, а из самого ответа:
     * {@code QueueRowset} отдаёт границы отданного куска очереди, и они
     * верны даже тогда, когда подрезанное начало сдвинуло выдачу дальше
     * запрошенного места.
     *
     * <p>Размер порции зажимается в диапазон 1..10 000: запрос нулевой
     * страницы бессмыслен, а слишком большой кладёт бэкенд по памяти.
     * Полная страница означает, что за ней, скорее всего, есть ещё —
     * отдельного запроса на остаток очереди не делается.
     */
    public EventsPage pull(int partition, long offset, int requestedLimit) {
        final int limit = Math.min(clamp(requestedLimit), maxBatchSize);

        try {
            QueueRowset rowset = client.pullConsumer(PullConsumer.builder()
                    .setConsumerPath(consumerPath)
                    .setQueuePath(queuePath)
                    .setPartitionIndex(partition)
                    .setOffset(offset)
                    .setRowBatchReadOptions(RowBatchReadOptions.builder()
                            .setMaxRowCount(limit)
                            .build())
                    .build()).join();

            List<YTreeMapNode> rows = rowset.getYTreeRows();
            long startOffset = rowset.getStartOffset();

            List<EnrichedEvent> events = new ArrayList<>(rows.size());
            for (int i = 0; i < rows.size(); i++) {
                YTreeMapNode r = rows.get(i);
                events.add(new EnrichedEvent(
                        startOffset + i,
                        r.getStringO("event_id").orElse(null),
                        r.getStringO("title").orElse(null),
                        r.getStringO("url").orElse(null),
                        r.getStringO("h3_r9").orElse(null),
                        r.get("event_ts").map(YTreeNode::longValue).orElse(0L),
                        r.get("length_update").map(YTreeNode::longValue).orElse(0L),
                        r.getStringO("diff_url").orElse(null)));
            }

            return new EventsPage(Collections.unmodifiableList(events),
                    rowset.getFinishOffset(), rows.size() >= limit);
        } catch (RuntimeException e) {
            throw new YtReadException(
                    "q_enriched pull failed (partition=" + partition
                            + ", offset=" + offset
                            + ", limit=" + limit + "): " + e.getMessage(), e);
        }
    }

    /**
     * Двигает консьюмера после того, как страница уложена в кэш.
     *
     * <p>Сдвиг идёт с проверкой прежнего оффсета: если позицию подвинул
     * кто-то ещё — вторая реплика бэкенда или человек руками, — YTsaurus
     * отобьёт запрос конфликтом вместо того, чтобы молча затереть чужой
     * прогресс.
     */
    public void advance(int partition, long oldOffset, long newOffset) {
        try (ApiServiceTransaction tx = client
                .startTransaction(new StartTransaction(TransactionType.Tablet))
                .join()) {
            tx.advanceConsumer(AdvanceConsumer.builder()
                    .setConsumerPath(consumerPath)
                    .setQueuePath(queuePath)
                    .setPartitionIndex(partition)
                    .setOldOffset(oldOffset)
                    .setNewOffset(newOffset)
                    .build()).join();
            tx.commit().join();
        } catch (RuntimeException e) {
            throw new YtReadException(
                    "не удалось сдвинуть консьюмера (partition=" + partition
                            + ", " + oldOffset + " -> " + newOffset + "): "
                            + e.getMessage(), e);
        }
    }

    private static int clamp(int v) {
        return Math.max(1, Math.min(v, ABSOLUTE_MAX_BATCH));
    }
}
