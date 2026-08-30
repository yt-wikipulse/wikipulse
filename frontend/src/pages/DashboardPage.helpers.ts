import type { TrendPoint } from "../api/dashboard";

const HOUR_SECONDS = 3600;
const DAY_SECONDS = 86400;

/**
 * Сколько подписей оси оставляем: под каждым столбиком они не помещаются.
 * Шаг равный, последний столбик подписан всегда.
 */
const AXIS_LABELS = 6;

const BUCKET_LIMITS: Record<string, number> = {
  "24h": 24,
  "7d": 7,
  "30d": 30,
};

const hourFormat = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});
const dayFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
});
const dayLongFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});

/**
 * Шаг графика диктует выбранный период, а не поле `bucket_seconds` из ответа:
 * сутки смотрим по часам, неделю и месяц по дням. Бэкенд для недели отдаёт
 * часовой шаг, и без этого правила неделя рисовалась бы ста шестьюдесятью
 * восемью столбиками.
 */
export function chartStepSeconds(period: string): number {
  return period === "24h" ? HOUR_SECONDS : DAY_SECONDS;
}

export function isDailyChart(period: string): boolean {
  return chartStepSeconds(period) >= DAY_SECONDS;
}

/**
 * Границы суток берутся по UTC — так же, как их считает бэкенд, когда
 * сворачивает месяц. Восточнее Гринвича подпись совпадает с локальной датой,
 * западнее уедет на день назад; чинится в одном месте, но вместе с бэкендом.
 */
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

function capBuckets(points: TrendPoint[], period: string): TrendPoint[] {
  const limit = BUCKET_LIMITS[period];

  if (limit === undefined || points.length <= limit) {
    return points;
  }

  return points.slice(-limit);
}

/**
 * Приводит точки тренда к шагу, нужному периоду: если пришедший шаг мельче,
 * часы складываются в сутки на фронте. Уже свёрнутое бэкендом (период `30d`)
 * не трогается, чтобы не свернуть дважды.
 */
export function prepareBuckets(
  points: TrendPoint[],
  bucketSeconds: number,
  period: string,
): TrendPoint[] {
  if (points.length === 0 || bucketSeconds >= chartStepSeconds(period)) {
    return capBuckets(points, period);
  }

  return capBuckets(toDailyBuckets(points), period);
}

export function axisLabelIndexes(
  count: number,
  maxLabels: number = AXIS_LABELS,
): Set<number> {
  const step = Math.max(1, Math.ceil(count / maxLabels));
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

export function formatBucketRange(ts: number, daily: boolean): string {
  const start = new Date(ts * 1000);

  if (daily) {
    return dayLongFormat.format(start);
  }

  const end = new Date((ts + HOUR_SECONDS) * 1000);

  return `${dayFormat.format(start)}, ${hourFormat.format(start)} — ${hourFormat.format(end)}`;
}
