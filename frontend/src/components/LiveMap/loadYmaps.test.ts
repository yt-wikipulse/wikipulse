import { describe, expect, it } from "vitest";

import { readApiKey } from "./loadYmaps";

describe("readApiKey", () => {
  it("убирает пробелы вокруг ключа", () => {
    expect(readApiKey("  ключ  ")).toBe("ключ");
  });

  it("падает без переменной", () => {
    expect(() => readApiKey(undefined)).toThrow();
  });

  it("падает на пустой строке", () => {
    expect(() => readApiKey("   ")).toThrow();
  });
});
