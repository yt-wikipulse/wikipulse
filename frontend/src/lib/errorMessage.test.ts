import { describe, expect, it } from "vitest";

import { HttpError } from "../api/http";
import { describeError } from "./errorMessage";

const FALLBACK = "Не удалось загрузить данные карты";

describe("describeError", () => {
  it("добавляет код статуса к русской формулировке", () => {
    expect(describeError(new HttpError(503), FALLBACK)).toBe(
      `${FALLBACK}: сервер ответил 503`,
    );
  });

  it("отдельно называет таймаут запроса", () => {
    expect(
      describeError(new DOMException("timed out", "TimeoutError"), FALLBACK),
    ).toBe("Сервер не ответил вовремя");
  });

  it("не пропускает в интерфейс сообщения чужих ошибок", () => {
    expect(describeError(new TypeError("Failed to fetch"), FALLBACK)).toBe(
      FALLBACK,
    );
    expect(describeError("boom", FALLBACK)).toBe(FALLBACK);
  });
});
