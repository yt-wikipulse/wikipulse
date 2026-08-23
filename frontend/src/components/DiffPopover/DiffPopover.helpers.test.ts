import { describe, expect, it } from "vitest";

import type { DiffSegment } from "../../api/wikiDiff";
import {
  focusOnChange,
  formatEditAge,
  formatSizeDelta,
  pluralizeLines,
} from "./DiffPopover.helpers";

const text = (segments: DiffSegment[]) =>
  segments.map((segment) => segment.text).join("");

describe("formatEditAge", () => {
  it("считает возраст правки от момента открытия карточки", () => {
    expect(formatEditAge(1000, 1030)).toBe("только что");
    expect(formatEditAge(1000, 1000 + 120)).toBe("2 мин назад");
    expect(formatEditAge(1000, 1000 + 7200)).toBe("2 ч назад");
  });
});

describe("formatSizeDelta", () => {
  it("показывает знак и разделяет тысячи", () => {
    expect(formatSizeDelta(142)).toBe("+142 Б");
    expect(formatSizeDelta(-87)).toBe("−87 Б");
    expect(formatSizeDelta(12480)).toMatch(/^\+12\s?480 Б$/);
  });
});

describe("pluralizeLines", () => {
  it("склоняет строки по-русски", () => {
    expect(pluralizeLines(1)).toBe("строка");
    expect(pluralizeLines(4)).toBe("строки");
    expect(pluralizeLines(11)).toBe("строк");
  });
});

describe("focusOnChange", () => {
  const long = (char: string, n: number) => char.repeat(n);

  it("короткую строку не трогает", () => {
    const segments: DiffSegment[] = [
      { text: "было ", changed: false },
      { text: "1887", changed: true },
      { text: " года", changed: false },
    ];

    expect(focusOnChange(segments)).toEqual(segments);
  });

  it("оставляет правку видимой, даже если она в конце длинной строки", () => {
    const segments: DiffSegment[] = [
      { text: long("а", 500), changed: false },
      { text: "ссылка", changed: true },
    ];

    const result = focusOnChange(segments, 10, 10);

    expect(result[0].text).toBe("…" + long("а", 10));
    expect(result.at(-1)).toEqual({ text: "ссылка", changed: true });
  });

  it("обрезает хвост после правки", () => {
    const segments: DiffSegment[] = [
      { text: "правка", changed: true },
      { text: long("б", 500), changed: false },
    ];

    const result = focusOnChange(segments, 10, 10);

    expect(result.at(-1)!.text).toBe(long("б", 10) + "…");
  });

  it("держит в окне все правки строки, а не только первую", () => {
    const segments: DiffSegment[] = [
      { text: "1887", changed: true },
      { text: " и ", changed: false },
      { text: "1889", changed: true },
    ];

    expect(text(focusOnChange(segments, 5, 5))).toBe("1887 и 1889");
  });

  it("строку без подсветки просто режет по длине", () => {
    const segments: DiffSegment[] = [{ text: long("в", 500), changed: false }];

    expect(focusOnChange(segments, 10, 10).at(0)!.text).toBe(long("в", 20) + "…");
  });
});
