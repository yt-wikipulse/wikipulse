import { afterEach, describe, expect, it, vi } from "vitest";

import { getActiveHexagons } from "./hexagons";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(): { calls: string[] } {
  const calls: string[] = [];

  vi.stubGlobal("fetch", (input: string) => {
    calls.push(input);
    return Promise.resolve(
      new Response(JSON.stringify({ hexagons: [] }), { status: 200 }),
    );
  });

  return { calls };
}

describe("getActiveHexagons", () => {
  it("сериализует bbox и zoom в query контракта", async () => {
    const { calls } = stubFetch();

    await getActiveHexagons({
      minLng: 37.31,
      minLat: 55.57,
      maxLng: 37.85,
      maxLat: 55.91,
      zoom: 10,
    });

    expect(calls).toHaveLength(1);

    const url = new URL(calls[0], "http://localhost");

    expect(url.pathname).toBe("/api/v1/hexagons/active");
    expect(url.searchParams.get("min_lng")).toBe("37.31");
    expect(url.searchParams.get("min_lat")).toBe("55.57");
    expect(url.searchParams.get("max_lng")).toBe("37.85");
    expect(url.searchParams.get("max_lat")).toBe("55.91");
    expect(url.searchParams.get("zoom")).toBe("10");
  });

  it("бросает ошибку на не-2xx ответе", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response("", { status: 500 })),
    );

    await expect(
      getActiveHexagons({
        minLng: 0,
        minLat: 0,
        maxLng: 1,
        maxLat: 1,
        zoom: 5,
      }),
    ).rejects.toThrow("500");
  });
});
