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

// Шаг графика задаёт бэкенд полем bucket_seconds — фронт только решает,
// подписывать точку часом или датой.
export function isDailyChart(bucketSeconds: number): boolean {
  return bucketSeconds >= DAY_SECONDS;
}

// Подписи под каждым столбиком не помещаются — оставляем примерно шесть штук
// с равным шагом, последний столбик подписан всегда. На узком графике шесть
// подписей сталкиваются, поэтому вызывающий может попросить меньше.
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
