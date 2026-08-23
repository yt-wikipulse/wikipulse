import { describe, expect, it } from "vitest";

import { pickApiKey, readApiKeys } from "./loadYmaps";

describe("readApiKeys", () => {
  it("разбирает список ключей", () => {
    expect(readApiKeys(" a , b ,, c ")).toEqual(["a", "b", "c"]);
  });

  it("возвращает пустой список без переменной", () => {
    expect(readApiKeys(undefined)).toEqual([]);
  });
});

describe("pickApiKey", () => {
  it("выбирает ключ по доле", () => {
    expect(pickApiKey(["a", "b", "c"], 0)).toBe("a");
    expect(pickApiKey(["a", "b", "c"], 0.5)).toBe("b");
    expect(pickApiKey(["a", "b", "c"], 0.999)).toBe("c");
  });

  it("не выходит за границы при random === 1", () => {
    expect(pickApiKey(["a", "b"], 1)).toBe("b");
  });

  it("падает без ключей", () => {
    expect(() => pickApiKey([], 0)).toThrow();
  });
});
