import { describe, expect, it } from "vitest";

import { pluralizeEdits } from "../lib/format";
import {
  axisLabelIndexes,
  isDailyChart,
  prepareBuckets,
} from "./DashboardPage.helpers";

describe("isDailyChart", () => {
  it("сутки смотрим по часам, неделю и месяц — по дням", () => {
    expect(isDailyChart("24h")).toBe(false);
    expect(isDailyChart("7d")).toBe(true);
    expect(isDailyChart("30d")).toBe(true);
  });
});

describe("prepareBuckets", () => {
  const DAY = 86400;
  const HOUR = 3600;

  const hourly = [
    { bucket_ts: 0, edits_count: 1 },
    { bucket_ts: HOUR, edits_count: 2 },
    { bucket_ts: 2 * HOUR, edits_count: 3 },
    { bucket_ts: DAY, edits_count: 10 },
    { bucket_ts: DAY + HOUR, edits_count: 20 },
    { bucket_ts: DAY + 2 * HOUR, edits_count: 30 },
  ];

  it("для суток часовые точки не трогает", () => {
    expect(prepareBuckets(hourly, HOUR, "24h")).toEqual(hourly);
  });

  it("для недели складывает часы в дни", () => {
    expect(prepareBuckets(hourly, HOUR, "7d")).toEqual([
      { bucket_ts: 0, edits_count: 6 },
      { bucket_ts: DAY, edits_count: 60 },
    ]);
  });

  it("не сворачивает второй раз то, что бэкенд уже свернул", () => {
    const daily = [{ bucket_ts: DAY, edits_count: 60 }];

    expect(prepareBuckets(daily, DAY, "30d")).toBe(daily);
  });

  it("отдаёт дни по возрастанию времени", () => {
    const shuffled = [
      { bucket_ts: DAY + HOUR, edits_count: 20 },
      { bucket_ts: HOUR, edits_count: 2 },
    ];

    expect(
      prepareBuckets(shuffled, HOUR, "7d").map((point) => point.bucket_ts),
    ).toEqual([0, DAY]);
  });

  it("не падает на пустой витрине", () => {
    expect(prepareBuckets([], 0, "7d")).toEqual([]);
  });
});

describe("axisLabelIndexes", () => {
  it("подписывает последний столбик", () => {
    expect(axisLabelIndexes(24).has(23)).toBe(true);
  });

  it("оставляет не больше семи подписей", () => {
    expect(axisLabelIndexes(168).size).toBeLessThanOrEqual(7);
  });

  it("не падает на пустой витрине", () => {
    expect(axisLabelIndexes(0).size).toBe(0);
  });
});

describe("pluralizeEdits", () => {
  it("склоняет правки по-русски", () => {
    expect(pluralizeEdits(1)).toBe("правка");
    expect(pluralizeEdits(3)).toBe("правки");
    expect(pluralizeEdits(11)).toBe("правок");
  });
});
