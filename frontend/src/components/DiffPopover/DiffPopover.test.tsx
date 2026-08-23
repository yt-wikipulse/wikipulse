import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import type { HexagonEvent } from "../../api/hexagons";
import { DiffPopover } from "./DiffPopover";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const EVENT: HexagonEvent = {
  id: "ruwiki|154475554",
  title: "Эйфелева башня",
  url: "https://ru.wikipedia.org/wiki/Эйфелева_башня",
  diff_url:
    "https://ru.wikipedia.org/w/index.php?diff=154475554&oldid=154475304",
  length_update: 142,
  event_ts: 1_787_000_000,
};

const COMPARE_BODY = `
  <tr><td colspan="2" class="diff-lineno">Строка 42:</td></tr>
  <tr>
    <td class="diff-marker" data-marker="−"></td>
    <td class="diff-deletedline diff-side-deleted"><div>Башня построена в <del class="diffchange diffchange-inline">1887</del> году.</div></td>
    <td class="diff-marker" data-marker="+"></td>
    <td class="diff-addedline diff-side-added"><div>Башня построена в <ins class="diffchange diffchange-inline">1889</ins> году.</div></td>
  </tr>`;

function stubCompare(body: string) {
  const calls: string[] = [];

  vi.stubGlobal("fetch", (input: string) => {
    calls.push(input);
    return Promise.resolve(
      new Response(JSON.stringify({ compare: { body } }), { status: 200 }),
    );
  });

  return calls;
}

describe("DiffPopover", () => {
  it("запрашивает compare по ревизиям из diff_url и рендерит обе строки", async () => {
    const calls = stubCompare(COMPARE_BODY);

    render(<DiffPopover event={EVENT} openedAt={EVENT.event_ts + 120} />);

    await waitFor(() => {
      expect(screen.getByText(/1889/)).toBeTruthy();
    });

    const url = new URL(calls[0]);

    expect(url.origin).toBe("https://ru.wikipedia.org");
    expect(url.searchParams.get("action")).toBe("compare");
    expect(url.searchParams.get("fromrev")).toBe("154475304");
    expect(url.searchParams.get("torev")).toBe("154475554");
    expect(url.searchParams.get("origin")).toBe("*");

    expect(screen.getByText(/1887/).tagName).toBe("MARK");
    expect(
      screen
        .getByRole("link", { name: "Эйфелева башня" })
        .getAttribute("href"),
    ).toBe(EVENT.url);
    expect(screen.getByText("2 мин назад")).toBeTruthy();
    expect(screen.getByText("+142 Б")).toBeTruthy();
  });

  it("показывает ошибку и кнопку повтора, если MediaWiki не ответил", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response("", { status: 503 })),
    );

    render(<DiffPopover event={EVENT} openedAt={EVENT.event_ts} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    expect(screen.getByRole("button", { name: "Повторить" })).toBeTruthy();
  });

  it("не прячет ссылку на Википедию, когда строк больше лимита", async () => {
    const manyLines = Array.from(
      { length: 12 },
      (_unused, index) =>
        `<tr><td class="diff-addedline"><div>строка ${index}</div></td></tr>`,
    ).join("");

    stubCompare(manyLines);

    render(<DiffPopover event={EVENT} openedAt={EVENT.event_ts} />);

    await waitFor(() => {
      expect(screen.getByText(/Ещё 4 строки/)).toBeTruthy();
    });

    expect(
      screen
        .getByRole("link", { name: /Ещё 4 строки/ })
        .getAttribute("href"),
    ).toBe(EVENT.diff_url);
  });
});
