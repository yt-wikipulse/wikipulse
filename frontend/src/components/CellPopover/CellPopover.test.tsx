import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { ActiveHexagon } from "../../api/hexagons";
import { CellPopover } from "./CellPopover";

afterEach(() => {
  cleanup();
});

function hexagonWithTitles(titles: string[]): ActiveHexagon {
  return {
    h3_index: "891f1d48947ffff",
    events_count: titles.length,
    events: titles.map((title, index) => ({
      id: `event-${index}`,
      title,
      url: `https://ru.wikipedia.org/wiki/${title}`,
    })),
  };
}

describe("CellPopover", () => {
  it("ничего не рендерит, если hexagon === null", () => {
    const { container } = render(
      <CellPopover hexagon={null} onClose={() => {}} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("показывает число правок за окно", () => {
    render(
      <CellPopover
        hexagon={hexagonWithTitles(["Москва", "Москва", "Кремль"])}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText("Правок за 30 минут")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("группирует правки по статье, сортирует по убыванию и режет по топ-3", () => {
    const hexagon = hexagonWithTitles([
      "Москва",
      "Москва",
      "Кремль",
      "Кремль",
      "Кремль",
      "Арбат",
      "Тверская",
    ]);

    render(<CellPopover hexagon={hexagon} onClose={() => {}} />);

    expect(screen.getByText("Кремль")).toBeTruthy();
    expect(screen.getByText("3 правки")).toBeTruthy();

    expect(screen.getByText("Москва")).toBeTruthy();
    expect(screen.getByText("2 правки")).toBeTruthy();

    expect(screen.getByText("Арбат")).toBeTruthy();
    expect(screen.getByText("1 правка")).toBeTruthy();

    expect(screen.queryByText("Тверская")).toBeNull();
  });

  it("склоняет «правок» для чисел вроде 11", () => {
    const hexagon = hexagonWithTitles(Array(11).fill("Спорная статья"));

    render(<CellPopover hexagon={hexagon} onClose={() => {}} />);

    expect(screen.getByText("11 правок")).toBeTruthy();
  });

  it("ссылка на статью ведёт на её url и открывается в новой вкладке", () => {
    render(
      <CellPopover
        hexagon={hexagonWithTitles(["Москва"])}
        onClose={() => {}}
      />,
    );

    const link = screen.getByRole("link", { name: /Москва/ });

    expect(link.getAttribute("href")).toBe(
      "https://ru.wikipedia.org/wiki/Москва",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });

  it("закрывается по клику на крестик", () => {
    const onClose = vi.fn();

    render(
      <CellPopover
        hexagon={hexagonWithTitles(["Москва"])}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("закрывается по Escape", () => {
    const onClose = vi.fn();

    render(
      <CellPopover
        hexagon={hexagonWithTitles(["Москва"])}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });
});
