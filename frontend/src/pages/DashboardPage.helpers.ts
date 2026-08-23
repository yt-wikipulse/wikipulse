import type { TrendPoint } from "../api/dashboard";

const HOUR_SECONDS = 3600;
const DAY_SECONDS = 86400;

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

// Шаг графика диктует выбранный период, а не бэкенд: сутки смотрим по часам,
// неделю и месяц — по дням.
export function chartStepSeconds(period: string): number {
  return period === "24h" ? HOUR_SECONDS : DAY_SECONDS;
}

export function isDailyChart(period: string): boolean {
  return chartStepSeconds(period) >= DAY_SECONDS;
}

// ponytail: сутки режем по UTC — так же, как бэкенд сворачивает 30d.
// Восточнее Гринвича подпись совпадает, западнее дата уедет на день назад.
function toDailyBuckets(points: TrendPoint[]): TrendPoint[] {
  const byDay = new Map<number, number>();

  for (const point of points) {
    const dayStart =
      Math.floor(point.bucket_ts / DAY_SECONDS) * DAY_SECONDS;

    byDay.set(dayStart, (byDay.get(dayStart) ?? 0) + point.edits_count);
  }

  return [...byDay.entries()]
    .map(([bucket_ts, edits_count]) => ({ bucket_ts, edits_count }))
    .sort((a, b) => a.bucket_ts - b.bucket_ts);
}

/**
 * Бэкенд отдаёт часовые точки для 24h и 7d и суточные для 30d. Если шаг
 * мельче, чем нужно периоду, складываем сами — иначе за неделю получаем
 * 168 столбиков вместо семи.
 */
export function prepareBuckets(
  points: TrendPoint[],
  bucketSeconds: number,
  period: string,
): TrendPoint[] {
  if (points.length === 0 || bucketSeconds >= chartStepSeconds(period)) {
    return points;
  }

  return toDailyBuckets(points);
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
