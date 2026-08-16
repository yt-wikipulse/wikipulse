import { describe, expect, it } from "vitest";

import {
  axisLabelIndexes,
  groupTrends,
  parsePeriodHours,
  pluralizeEdits,
  sharePercent,
} from "./DashboardPage.helpers";

const HOUR = 3600;

function hourlyTrends(count: number, from: number) {
  return Array.from({ length: count }, (_, index) => ({
    bucket_ts: from + index * HOUR,
    edits_count: 10,
  }));
}

describe("parsePeriodHours", () => {
  it("читает часы из строки периода", () => {
    expect(parsePeriodHours("1h")).toBe(1);
    expect(parsePeriodHours("720h")).toBe(720);
  });

  it("возвращает 0 на мусоре", () => {
    expect(parsePeriodHours("сутки")).toBe(0);
  });
});

describe("groupTrends", () => {
  it("оставляет часы как есть на коротком периоде", () => {
    const trends = hourlyTrends(24, 0);

    expect(groupTrends(trends, 24)).toHaveLength(24);
  });

  it("схлопывает часы в дни на длинном периоде", () => {
    // Считаем от локальной полуночи: границы суток у чарта локальные.
    const midnight = Math.floor(new Date(2026, 0, 5).getTime() / 1000);
    const buckets = groupTrends(hourlyTrends(72, midnight), 72);

    expect(buckets).toHaveLength(3);
    expect(buckets[0].editsCount).toBe(240);
    expect(buckets[0].ts).toBe(midnight);
  });

  it("не падает на пустой витрине", () => {
    expect(groupTrends([], 720)).toEqual([]);
  });
});

describe("axisLabelIndexes", () => {
  it("подписывает последний столбик", () => {
    expect(axisLabelIndexes(24).has(23)).toBe(true);
  });

  it("оставляет не больше семи подписей", () => {
    expect(axisLabelIndexes(720).size).toBeLessThanOrEqual(7);
  });
});

describe("pluralizeEdits", () => {
  it("склоняет правки по-русски", () => {
    expect(pluralizeEdits(1)).toBe("правка");
    expect(pluralizeEdits(3)).toBe("правки");
    expect(pluralizeEdits(11)).toBe("правок");
  });
});

describe("sharePercent", () => {
  it("не делит на ноль", () => {
    expect(sharePercent(10, 0)).toBe("0%");
  });
});
