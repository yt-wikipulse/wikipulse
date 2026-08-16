import type { TrendPoint } from "../api/dashboard";

export type ChartBucket = {
  ts: number;
  editsCount: number;
};

// Витрина трендов всегда почасовая. За неделю это 168 столбиков, за месяц —
// 720: в такой график смотреть невозможно, поэтому длинные периоды
// схлопываем в дни. Порог — двое суток.
const HOURLY_CHART_MAX_HOURS = 48;

const AXIS_LABELS = 6;

const numberFormat = new Intl.NumberFormat("ru-RU");
const pluralRules = new Intl.PluralRules("ru-RU");
const hourFormat = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});
const dayFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
});

export function parsePeriodHours(period: string): number {
  const hours = Number.parseInt(period, 10);
  return Number.isFinite(hours) && hours > 0 ? hours : 0;
}

export function isDailyChart(hours: number): boolean {
  return hours > HOURLY_CHART_MAX_HOURS;
}

export function groupTrends(
  trends: TrendPoint[],
  hours: number,
): ChartBucket[] {
  if (!isDailyChart(hours)) {
    return trends.map((point) => ({
      ts: point.bucket_ts,
      editsCount: point.edits_count,
    }));
  }

  const days = new Map<number, number>();

  for (const point of trends) {
    const day = startOfLocalDay(point.bucket_ts);
    days.set(day, (days.get(day) ?? 0) + point.edits_count);
  }

  return [...days.entries()]
    .sort(([left], [right]) => left - right)
    .map(([ts, editsCount]) => ({ ts, editsCount }));
}

// Подписи под каждым столбиком не помещаются — оставляем примерно шесть штук
// с равным шагом, последний столбик подписан всегда.
export function axisLabelIndexes(count: number): Set<number> {
  const step = Math.max(1, Math.ceil(count / AXIS_LABELS));
  const indexes = new Set<number>();

  for (let index = 0; index < count; index += step) {
    indexes.add(index);
  }

  if (count > 0) {
    indexes.add(count - 1);
  }

  return indexes;
}

export function formatBucketLabel(ts: number, daily: boolean): string {
  const date = new Date(ts * 1000);
  return daily ? dayFormat.format(date) : hourFormat.format(date);
}

export function formatCount(value: number): string {
  return numberFormat.format(value);
}

export function pluralizeEdits(value: number): string {
  switch (pluralRules.select(value)) {
    case "one":
      return "правка";
    case "few":
      return "правки";
    default:
      return "правок";
  }
}

export function sharePercent(value: number, total: number): string {
  if (total <= 0) {
    return "0%";
  }

  return `${((value / total) * 100).toFixed(1).replace(".", ",")}%`;
}

function startOfLocalDay(ts: number): number {
  const date = new Date(ts * 1000);
  date.setHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}
