import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Link } from "react-router-dom";

import { SegmentedTabs } from "../components/SegmentedTabs/SegmentedTabs";
import { Spinner } from "../components/Spinner/Spinner";
import { useDashboardData } from "../features/dashboard/useDashboardData";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { formatNumber, pluralizeEdits } from "../lib/format";
import styles from "./DashboardPage.module.scss";
import {
  axisLabelIndexes,
  formatBucketLabel,
  formatBucketRange,
  isDailyChart,
  prepareBuckets,
} from "./DashboardPage.helpers";

const COMPACT_AXIS = "(max-width: 1279px)";
const COMPACT_AXIS_LABELS = 4;

const PERIODS = [
  { value: "24h", tab: "1 день", caption: "последние сутки" },
  { value: "7d", tab: "1 неделя", caption: "последняя неделя" },
  { value: "30d", tab: "1 месяц", caption: "последний месяц" },
];

export function DashboardPage() {
  useDocumentTitle("WikiPulse — Дашборд");

  const [period, setPeriod] = useState(PERIODS[0].value);
  const { data, loading, error, reload } = useDashboardData(period);
  const compactAxis = useMediaQuery(COMPACT_AXIS);

  const caption =
    PERIODS.find((item) => item.value === period)?.caption ?? period;
  const daily = isDailyChart(period);
  const buckets = prepareBuckets(
    data?.trends ?? [],
    data?.bucket_seconds ?? 0,
    period,
  );
  const maxEdits = Math.max(...buckets.map((bucket) => bucket.edits_count), 1);
  const axisLabels = axisLabelIndexes(
    buckets.length,
    compactAxis ? COMPACT_AXIS_LABELS : undefined,
  );

  const totalEdits = data?.total_edits ?? 0;
  const topArticle = data?.top_articles[0];
  const topPlace = data?.top_geo[0];
  const isEmpty = Boolean(data) && totalEdits === 0;

  const viewKey = error
    ? `${period}:error`
    : loading
      ? `${period}:loading`
      : isEmpty
        ? `${period}:empty`
        : `${period}:data`;

  return (
    <main className={styles.dashboardPage} aria-labelledby="dashboard-title">
      <header className={styles.dashboardPage__head}>
        <div className={styles.dashboardPage__heading}>
          <h1 id="dashboard-title" className={styles.dashboardPage__title}>
            Аналитика правок
          </h1>
        </div>

        <SegmentedTabs
          ariaLabel="Период"
          items={PERIODS.map((item) => ({
            value: item.value,
            label: item.tab,
          }))}
          value={period}
          onChange={setPeriod}
        />
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={viewKey}
          className={styles.dashboardPage__view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {error ? (
            <section className={styles.dashboardPage__notice} role="alert">
              <p>{error}</p>
              <button
                type="button"
                className={styles.dashboardPage__retry}
                onClick={reload}
              >
                Повторить
              </button>
            </section>
          ) : null}

          {!error && loading && !data ? (
            <div className={styles.dashboardPage__loading}>
              <Spinner label="Загружаем витрины" size="large" />
            </div>
          ) : null}

          {!error && isEmpty ? (
            <section className={styles.dashboardPage__notice}>
              <p>
                За {caption} правок нет. Витрины пересчитываются раз в час — если
                период только что открылся, данные появятся после ближайшего
                пересчёта.
              </p>
            </section>
          ) : null}

          {data && !isEmpty ? (
            <div className={styles.dashboardPage__grid}>
              <section className={styles.dashboardPage__kpis}>
                <article className={styles.dashboardPage__kpi}>
                  <h2 className={styles.dashboardPage__label}>Всего правок</h2>
                  <p className={styles.dashboardPage__value}>
                    {formatNumber(totalEdits)}
                  </p>
                </article>

                <article className={styles.dashboardPage__kpi}>
                  <h2 className={styles.dashboardPage__label}>Топ статья</h2>
                  <p className={styles.dashboardPage__value}>
                    {topArticle ? topArticle.title : "—"}
                  </p>
                  {topArticle ? (
                    <p className={styles.dashboardPage__caption}>
                      <span className={styles.dashboardPage__accent}>
                        {formatNumber(topArticle.edits_count)}
                      </span>{" "}
                      {pluralizeEdits(topArticle.edits_count)}
                    </p>
                  ) : null}
                </article>

                <article className={styles.dashboardPage__kpi}>
                  <h2 className={styles.dashboardPage__label}>Топ место</h2>
                  <p className={styles.dashboardPage__value}>
                    {topPlace ? topPlace.top_title : "—"}
                  </p>
                  {topPlace ? (
                    <p className={styles.dashboardPage__caption}>
                      <span className={styles.dashboardPage__accent}>
                        {formatNumber(topPlace.edits_count)}
                      </span>{" "}
                      {pluralizeEdits(topPlace.edits_count)} ·{" "}
                      {formatNumber(topPlace.articles_count)} статей
                    </p>
                  ) : null}
                </article>
              </section>

              <section className={styles.dashboardPage__card}>
                <h2 className={styles.dashboardPage__label}>Топ статей</h2>
                <ol className={styles.dashboardPage__list}>
                  {data.top_articles.map((article, index) => (
                    <li key={article.url} className={styles.dashboardPage__row}>
                      <span className={styles.dashboardPage__rank}>
                        {index + 1}
                      </span>
                      <a
                        className={styles.dashboardPage__link}
                        href={article.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {article.title}
                      </a>
                      <span className={styles.dashboardPage__rowValue}>
                        {formatNumber(article.edits_count)}
                      </span>
                      <span className={styles.dashboardPage__track}>
                        <span
                          className={styles.dashboardPage__bar}
                          style={{
                            width: `${barWidth(article.edits_count, data.top_articles)}%`,
                          }}
                        />
                      </span>
                    </li>
                  ))}
                </ol>
              </section>

              <section
                className={`${styles.dashboardPage__card} ${styles["dashboardPage__card--chart"]}`}
              >
                <h2 className={styles.dashboardPage__label}>
                  {daily ? "Правки по дням" : "Правки по часам"}
                </h2>
                <div className={styles.dashboardPage__chart} role="list">
                  {buckets.map((bucket, index) => (
                    <div
                      key={bucket.bucket_ts}
                      className={styles.dashboardPage__column}
                      role="listitem"
                      tabIndex={0}
                      aria-label={`${formatBucketRange(bucket.bucket_ts, daily)} — ${formatNumber(bucket.edits_count)} ${pluralizeEdits(bucket.edits_count)}`}
                    >
                      <span className={styles.dashboardPage__columnTrack}>
                        <span
                          className={styles.dashboardPage__columnBar}
                          style={{
                            height: `${(bucket.edits_count / maxEdits) * 100}%`,
                          }}
                        >
                          <span
                            className={styles.dashboardPage__tooltip}
                            aria-hidden="true"
                          >
                            <span className={styles.dashboardPage__tooltipDate}>
                              {formatBucketRange(bucket.bucket_ts, daily)}
                            </span>
                            <span
                              className={styles.dashboardPage__tooltipValue}
                            >
                              {formatNumber(bucket.edits_count)}{" "}
                              {pluralizeEdits(bucket.edits_count)}
                            </span>
                          </span>
                        </span>
                      </span>
                      <span className={styles.dashboardPage__columnLabel}>
                        {axisLabels.has(index)
                          ? formatBucketLabel(bucket.bucket_ts, daily)
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section
                className={`${styles.dashboardPage__card} ${styles["dashboardPage__card--wide"]}`}
              >
                <h2 className={styles.dashboardPage__label}>Топ мест</h2>
                <ol className={styles.dashboardPage__list}>
                  {data.top_geo.map((place, index) => (
                    <li key={place.h3_parent} className={styles.dashboardPage__row}>
                      <span className={styles.dashboardPage__rank}>
                        {index + 1}
                      </span>
                      <Link
                        className={styles.dashboardPage__link}
                        to={`/map?h3=${place.h3_parent}`}
                      >
                        {place.top_title}
                      </Link>
                      <span className={styles.dashboardPage__rowValue}>
                        {formatNumber(place.edits_count)}
                      </span>
                      <span className={styles.dashboardPage__track}>
                        <span
                          className={styles.dashboardPage__bar}
                          style={{
                            width: `${barWidth(place.edits_count, data.top_geo)}%`,
                          }}
                        />
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

function barWidth(value: number, rows: { edits_count: number }[]): number {
  const max = Math.max(...rows.map((row) => row.edits_count), 1);
  return (value / max) * 100;
}
