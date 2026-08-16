import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { MapStatus } from "./MapStatus";

afterEach(() => {
  cleanup();
});

const BASE_PROPS = {
  loading: false,
  isBackgroundRefreshing: false,
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

  it("показывает счётчик ячеек без ошибок и без Retry, когда всё хорошо", () => {
    render(<MapStatus {...BASE_PROPS} />);

    expect(screen.getByText("Живая карта")).toBeTruthy();
    expect(screen.getByText(/Ячеек:\s*3/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("показывает предупреждение без Retry, если данные уже есть, а фоновый запрос упал", () => {
    render(<MapStatus {...BASE_PROPS} error="Не удалось загрузить данные карты" />);

    expect(screen.getByText(/Ячеек:\s*3/)).toBeTruthy();
    expect(
      screen.getByText("Не удалось загрузить данные карты"),
    ).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("показывает индикатор фонового обновления, не мешая счётчику", () => {
    const { container } = render(
      <MapStatus {...BASE_PROPS} isBackgroundRefreshing />,
    );

    expect(screen.getByText(/Ячеек:\s*3/)).toBeTruthy();
    expect(
      container.querySelector('[data-visible="true"]'),
    ).not.toBeNull();
  });

  it("не меняет layout, когда фоновое обновление выключено — индикатор в DOM, но скрыт", () => {
    const { container } = render(<MapStatus {...BASE_PROPS} />);

    const indicator = container.querySelector('[aria-hidden="true"]');

    expect(indicator).not.toBeNull();
    expect(indicator?.getAttribute("data-visible")).toBe("false");
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
