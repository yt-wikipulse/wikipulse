import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { MapStatus } from "./MapStatus";

afterEach(() => {
  cleanup();
});

const BASE_PROPS = {
  loading: false,
  error: null,
  cellCount: 3,
  onRetry: () => {},
};

describe("MapStatus", () => {
  it("показывает загрузку, пока данных ещё нет", () => {
    render(<MapStatus {...BASE_PROPS} loading />);

    expect(screen.getByText("Загрузка…")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("показывает ошибку и Retry, если данных нет вообще", () => {
    const onRetry = vi.fn();

    render(
      <MapStatus
        {...BASE_PROPS}
        cellCount={0}
        error="Failed to load active hexagons: 502"
        onRetry={onRetry}
      />,
    );

    expect(
      screen.getByText("Failed to load active hexagons: 502"),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("показывает счётчик и окно, когда всё хорошо", () => {
    render(<MapStatus {...BASE_PROPS} />);

    expect(screen.getByText("3 ячейки")).toBeTruthy();
    expect(screen.getByText("за 30 минут")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("склоняет ячейки по числу", () => {
    const { rerender } = render(<MapStatus {...BASE_PROPS} cellCount={1} />);
    expect(screen.getByText("1 ячейка")).toBeTruthy();

    rerender(<MapStatus {...BASE_PROPS} cellCount={11} />);
    expect(screen.getByText("11 ячеек")).toBeTruthy();

    rerender(<MapStatus {...BASE_PROPS} cellCount={128} />);
    expect(screen.getByText("128 ячеек")).toBeTruthy();
  });

  it("не показывает ноль ячеек числом", () => {
    render(<MapStatus {...BASE_PROPS} cellCount={0} />);

    expect(screen.getByText("Нет правок")).toBeTruthy();
  });

  it("сохраняет счётчик и предупреждает, если фоновый запрос упал", () => {
    render(
      <MapStatus {...BASE_PROPS} error="Не удалось загрузить данные карты" />,
    );

    expect(screen.getByText("3 ячейки")).toBeTruthy();
    expect(
      screen.getByText("Не удалось загрузить данные карты"),
    ).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("не роняет фокус в body, когда Retry исчезает из-за фонового поллинга", () => {
    const { container, rerender } = render(
      <MapStatus
        {...BASE_PROPS}
        cellCount={0}
        error="Failed to load active hexagons: 502"
      />,
    );

    const retryButton = screen.getByRole("button", { name: "Повторить" });
    retryButton.focus();
    expect(document.activeElement).toBe(retryButton);

    rerender(<MapStatus {...BASE_PROPS} />);

    expect(document.activeElement).toBe(container.firstChild);
    expect(document.activeElement).not.toBe(document.body);
  });
});
