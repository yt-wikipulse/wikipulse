import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLiveMapData } from "./useLiveMapData";

const VIEWPORT = {
  minLng: 0,
  minLat: 0,
  maxLng: 1,
  maxLat: 1,
  zoom: 5,
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

async function flushMicrotasks() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("useLiveMapData", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("выключает loading только после первого ответа, данные приходят в hexagons", async () => {
    vi.stubGlobal("fetch", () =>
      jsonResponse({
        hexagons: [{ h3_index: "a", events_count: 1, events: [] }],
      }),
    );

    const { result } = renderHook(() => useLiveMapData(VIEWPORT));

    expect(result.current.loading).toBe(true);

    await flushMicrotasks();

    expect(result.current.loading).toBe(false);
    expect(result.current.hexagons).toHaveLength(1);
  });

  it("следующий тик поллинга — фоновый рефреш, а не повторная блокирующая загрузка", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ hexagons: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLiveMapData(VIEWPORT));

    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false);
  });

  it("retry() форсирует запрос немедленно, не дожидаясь тика поллинга", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ hexagons: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLiveMapData(VIEWPORT));

    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.retry();
    });

    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("не даёт двум запросам наложиться — retry во время in-flight игнорируется", async () => {
    let resolveFetch: (response: Response) => void = () => {};

    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLiveMapData(VIEWPORT));

    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.retry();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch(new Response(JSON.stringify({ hexagons: [] }), { status: 200 }));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.loading).toBe(false);
  });

  it("при ошибке фонового запроса сохраняет прежние hexagons и выставляет error", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        jsonResponse({
          hexagons: [{ h3_index: "a", events_count: 1, events: [] }],
        }),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(new Response("", { status: 500 })),
      );

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useLiveMapData(VIEWPORT));

    await flushMicrotasks();
    expect(result.current.hexagons).toHaveLength(1);
    expect(result.current.error).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.hexagons).toHaveLength(1);
    expect(result.current.loading).toBe(false);
  });

  it("при viewport === null ничего не запрашивает", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ hexagons: [] }));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useLiveMapData(null));

    await flushMicrotasks();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
