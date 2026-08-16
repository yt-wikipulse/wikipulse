package com.springboot.web.wikipulseproject.yt_repo;

import com.springboot.web.wikipulseproject.error.BadRequestException;
import com.springboot.web.wikipulseproject.error.YtReadException;
import com.springboot.web.wikipulseproject.model.TopArticle;
import com.springboot.web.wikipulseproject.model.TopGeoPlace;
import com.springboot.web.wikipulseproject.model.TrendPoint;
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
import java.util.List;
import java.util.function.Function;
import java.util.regex.Pattern;

@Repository
@Profile("yt")
public class YtAggregatesRepository {

    private static final int ABSOLUTE_MAX_LIMIT = 1000;
    private static final Pattern PERIOD_PATTERN = Pattern.compile("^\\d+h$");

    private final YTsaurusClient client;
    private final String trendsTable;
    private final String topArticlesTable;
    private final String topGeoTable;

    public YtAggregatesRepository(
            @Value("${yt.proxy}") String proxy,
            @Value("${yt.token}") String token,
            @Value("${yt.table.marts.trends}") String trendsTable,
            @Value("${yt.table.marts.top_articles}") String topArticlesTable,
            @Value("${yt.table.marts.top_geo}") String topGeoTable) {
        this.client = YTsaurusClient.builder()
                .setCluster(proxy)
                .setAuth(YTsaurusClientAuth.builder().setToken(token).build())
                .build();
        this.trendsTable = trendsTable;
        this.topArticlesTable = topArticlesTable;
        this.topGeoTable = topGeoTable;
    }

    public List<TrendPoint> fetchTrends(long fromBucketTs) {
        String query = "bucket_ts, edits_count FROM [" + trendsTable
                + "] WHERE bucket_ts >= " + fromBucketTs + " ORDER BY bucket_ts";
        return select(query, "marts/trends", r -> new TrendPoint(
                r.get("bucket_ts").map(YTreeNode::longValue).orElse(0L),
                r.get("edits_count").map(YTreeNode::longValue).orElse(0L)));
    }

    public List<TopArticle> fetchTopArticles(String period, int limit) {
        String query = "title, url, edits_count FROM [" + topArticlesTable
                + "] WHERE period = \"" + requirePeriod(period)
                + "\" ORDER BY rank LIMIT " + clampLimit(limit);
        return select(query, "marts/top_articles", r -> new TopArticle(
                r.getStringO("title").orElse(null),
                r.getStringO("url").orElse(null),
                r.get("edits_count").map(YTreeNode::longValue).orElse(0L)));
    }

    public List<TopGeoPlace> fetchTopGeo(String period, int limit) {
        String query = "h3_parent, top_title, top_url, edits_count, articles_count FROM ["
                + topGeoTable + "] WHERE period = \"" + requirePeriod(period)
                + "\" ORDER BY rank LIMIT " + clampLimit(limit);
        return select(query, "marts/top_geo", r -> new TopGeoPlace(
                r.getStringO("h3_parent").orElse(null),
                r.getStringO("top_title").orElse(null),
                r.getStringO("top_url").orElse(null),
                r.get("edits_count").map(YTreeNode::longValue).orElse(0L),
                r.get("articles_count").map(YTreeNode::longValue).orElse(0L)));
    }

    private <T> List<T> select(String query, String source, Function<YTreeMapNode, T> mapper) {
        try (ApiServiceTransaction tx = client
                .startTransaction(new StartTransaction(TransactionType.Master))
                .join()) {
            UnversionedRowset rowset = tx.selectRows(SelectRowsRequest.of(query)).join();
            List<YTreeMapNode> rows = rowset.getYTreeRows();
            List<T> result = new ArrayList<>(rows.size());
            for (YTreeMapNode row : rows) {
                result.add(mapper.apply(row));
            }
            return result;
        } catch (RuntimeException e) {
            throw new YtReadException(source + " select failed: " + e.getMessage(), e);
        }
    }

    private static String requirePeriod(String period) {
        if (period == null || !PERIOD_PATTERN.matcher(period).matches()) {
            throw new BadRequestException("period must look like \"24h\", got: " + period);
        }
        return period;
    }

    private static int clampLimit(int v) {
        return Math.max(1, Math.min(v, ABSOLUTE_MAX_LIMIT));
    }
}
