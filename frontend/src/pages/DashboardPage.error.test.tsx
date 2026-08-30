import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardPage } from "./DashboardPage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DashboardPage", () => {
  it("показывает сообщение об ошибке ровно один раз", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response("", { status: 404 })),
    );
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    const alert = await screen.findByRole("alert");

    expect(alert.textContent).toContain(
      "Не удалось загрузить дашборд: сервер ответил 404",
    );
    expect(alert.textContent?.match(/Не удалось загрузить дашборд/g)).toHaveLength(1);
  });
});
