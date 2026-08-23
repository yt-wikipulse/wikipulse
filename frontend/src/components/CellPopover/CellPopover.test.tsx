import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import type { ActiveHexagon } from "../../api/hexagons";
import { CellPopover } from "./CellPopover";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function hexagonWithTitles(titles: string[]): ActiveHexagon {
  return {
    h3_index: "891f1d48947ffff",
    events_count: titles.length,
    events: titles.map((title, index) => ({
      id: `event-${index}`,
      title,
      url: `https://ru.wikipedia.org/wiki/${title}`,
      length_update: 100 + index,
      diff_url: `https://ru.wikipedia.org/w/index.php?diff=${index + 2}&oldid=${index + 1}`,
      event_ts: 1_700_000_000 + index,
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
  it("по наведению на статью показывает diff её последней правки", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const calls: string[] = [];

    vi.stubGlobal("fetch", (input: string) => {
      calls.push(input);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            compare: {
              body: `<tr><td class="diff-addedline"><div>новый текст статьи</div></td></tr>`,
            },
          }),
          { status: 200 },
        ),
      );
    });

    render(
      <CellPopover
        hexagon={hexagonWithTitles(["Москва", "Москва"])}
        onClose={() => {}}
      />,
    );

    expect(screen.queryByText("новый текст статьи")).toBeNull();

    fireEvent.pointerEnter(
      screen.getByRole("link", { name: /Москва/ }).parentElement!,
      { pointerType: "mouse" },
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByText("новый текст статьи")).toBeTruthy();
    });

    expect(new URL(calls[0]).searchParams.get("torev")).toBe("3");
  });

  it("не дёргает MediaWiki, если курсор просто проехал по строке", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CellPopover
        hexagon={hexagonWithTitles(["Москва"])}
        onClose={() => {}}
      />,
    );

    const row = screen.getByRole("link", { name: /Москва/ }).parentElement!;

    fireEvent.pointerEnter(row, { pointerType: "mouse" });
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    fireEvent.pointerLeave(row, { pointerType: "mouse" });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("по тапу открывает diff вместо перехода на статью", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            compare: {
              body: `<tr><td class="diff-addedline"><div>новый текст статьи</div></td></tr>`,
            },
          }),
          { status: 200 },
        ),
      ),
    );

    render(
      <CellPopover
        hexagon={hexagonWithTitles(["Москва"])}
        onClose={() => {}}
      />,
    );

    const row = screen.getByRole("link", { name: /Москва/ });
    const firstTap = fireEvent.click(row);

    expect(firstTap).toBe(false);

    await waitFor(() => {
      expect(screen.getByText("новый текст статьи")).toBeTruthy();
    });

    expect(fireEvent.click(row)).toBe(true);
  });
  it("не закрывает diff, когда тап просто снимает фокус со строки", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            compare: {
              body: `<tr><td class="diff-addedline"><div>новый текст статьи</div></td></tr>`,
            },
          }),
          { status: 200 },
        ),
      ),
    );

    render(
      <CellPopover
        hexagon={hexagonWithTitles(["Москва"])}
        onClose={() => {}}
      />,
    );

    const row = screen.getByRole("link", { name: /Москва/ });

    fireEvent.click(row);

    await waitFor(() => {
      expect(screen.getByText("новый текст статьи")).toBeTruthy();
    });

    // После тапа браузер снимает фокус со ссылки, relatedTarget при этом пуст.
    fireEvent.blur(row, { relatedTarget: null });

    expect(screen.getByText("новый текст статьи")).toBeTruthy();
  });
  it("оставляет diff открытым, когда его открыли кликом и увели курсор", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            compare: {
              body: `<tr><td class="diff-addedline"><div>новый текст статьи</div></td></tr>`,
            },
          }),
          { status: 200 },
        ),
      ),
    );

    render(
      <CellPopover
        hexagon={hexagonWithTitles(["Москва"])}
        onClose={() => {}}
      />,
    );

    const row = screen.getByRole("link", { name: /Москва/ });

    fireEvent.click(row);

    await waitFor(() => {
      expect(screen.getByText("новый текст статьи")).toBeTruthy();
    });

    fireEvent.pointerLeave(row.parentElement!, { pointerType: "mouse" });

    expect(screen.getByText("новый текст статьи")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Закрыть diff" }));

    expect(screen.queryByText("новый текст статьи")).toBeNull();
  });

  it("закрывает diff, открытый наведением, когда курсор ушёл", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            compare: {
              body: `<tr><td class="diff-addedline"><div>новый текст статьи</div></td></tr>`,
            },
          }),
          { status: 200 },
        ),
      ),
    );

    render(
      <CellPopover
        hexagon={hexagonWithTitles(["Москва"])}
        onClose={() => {}}
      />,
    );

    const row = screen.getByRole("link", { name: /Москва/ }).parentElement!;

    fireEvent.pointerEnter(row, { pointerType: "mouse" });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByText("новый текст статьи")).toBeTruthy();
    });

    fireEvent.pointerLeave(row, { pointerType: "mouse" });

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByText("новый текст статьи")).toBeNull();
  });

  it("не закрывает diff, пока курсор переходит на саму карточку", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            compare: {
              body: `<tr><td class="diff-addedline"><div>новый текст статьи</div></td></tr>`,
            },
          }),
          { status: 200 },
        ),
      ),
    );

    render(
      <CellPopover
        hexagon={hexagonWithTitles(["Москва"])}
        onClose={() => {}}
      />,
    );

    const row = screen.getByRole("link", { name: /Москва/ }).parentElement!;

    fireEvent.pointerEnter(row, { pointerType: "mouse" });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByText("новый текст статьи")).toBeTruthy();
    });

    const card = screen
      .getByText("новый текст статьи")
      .closest('[class*="cellPopover__diff"]')!;

    // Курсор уходит со строки и тут же попадает на карточку.
    fireEvent.pointerLeave(row, { pointerType: "mouse" });
    fireEvent.pointerEnter(card, { pointerType: "mouse" });

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText("новый текст статьи")).toBeTruthy();
  });
});
