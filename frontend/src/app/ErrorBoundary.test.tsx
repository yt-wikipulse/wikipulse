import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ErrorBoundary } from "./ErrorBoundary";

function Boom(): never {
  throw new Error("render failed");
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("отдаёт детей, пока они рендерятся", () => {
    render(
      <ErrorBoundary>
        <p>содержимое</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("содержимое")).toBeTruthy();
  });

  it("подменяет упавшее поддерево экраном ошибки", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("heading", { name: "Что-то пошло не так" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Перезагрузить" })).toBeTruthy();
  });
});
