import { describe, expect, it } from "vitest";

import { formatNumber, plural, pluralizeEdits } from "./format";

const FORMS = {
  one: "ячейка",
  few: "ячейки",
  many: "ячеек",
};

describe("plural", () => {
  it("выбирает форму по правилам русского языка", () => {
    expect(plural(1, FORMS)).toBe("ячейка");
    expect(plural(2, FORMS)).toBe("ячейки");
    expect(plural(5, FORMS)).toBe("ячеек");
    expect(plural(0, FORMS)).toBe("ячеек");
  });

  it("одиннадцать и его соседи — не единственное число", () => {
    expect(plural(11, FORMS)).toBe("ячеек");
    expect(plural(12, FORMS)).toBe("ячеек");
    expect(plural(14, FORMS)).toBe("ячеек");
    expect(plural(21, FORMS)).toBe("ячейка");
    expect(plural(22, FORMS)).toBe("ячейки");
    expect(plural(111, FORMS)).toBe("ячеек");
  });
});

describe("pluralizeEdits", () => {
  it("склоняет правки", () => {
    expect(pluralizeEdits(1)).toBe("правка");
    expect(pluralizeEdits(3)).toBe("правки");
    expect(pluralizeEdits(11)).toBe("правок");
  });
});

describe("formatNumber", () => {
  it("разделяет разряды", () => {
    expect(formatNumber(1234567).replace(/\s/gu, " ")).toBe("1 234 567");
  });
});
