import { describe, expect, it } from "vitest";

import {
  axisLabelIndexes,
  isDailyChart,
  pluralizeEdits,
  sharePercent,
} from "./DashboardPage.helpers";

describe("isDailyChart", () => {
  it("часовой шаг подписывает временем, суточный — датой", () => {
    expect(isDailyChart(3600)).toBe(false);
    expect(isDailyChart(86400)).toBe(true);
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

describe("sharePercent", () => {
  it("не делит на ноль", () => {
    expect(sharePercent(10, 0)).toBe("0%");
  });
});
