import { describe, expect, it } from "vitest";
import type { LngLatBounds } from "@yandex/ymaps3-types";

import { toViewport } from "./viewport";

const bounds = (
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number,
) =>
  [
    [minLng, maxLat],
    [maxLng, minLat],
  ] as LngLatBounds;

describe("toViewport", () => {
  it("запрашивает область с запасом за краем экрана", () => {
    const viewport = toViewport(
      bounds(37, 55, 41, 57),
      7.4,
    );

    expect(viewport.minLng).toBeLessThan(37);
    expect(viewport.maxLng).toBeGreaterThan(41);
    expect(viewport.minLat).toBeLessThan(55);
    expect(viewport.maxLat).toBeGreaterThan(57);
    expect(viewport.zoom).toBe(7);
  });

  it("не меняет bbox, пока карта не переехала в соседнюю клетку", () => {
    expect(
      toViewport(bounds(37.1, 55.1, 41.1, 57.1), 7),
    ).toEqual(
      toViewport(bounds(37.6, 55.3, 41.6, 57.3), 7),
    );
  });

  it("не вылезает за границы координат", () => {
    const viewport = toViewport(
      bounds(-179, -89, 179, 89),
      2,
    );

    expect(viewport.minLng).toBeGreaterThanOrEqual(-180);
    expect(viewport.maxLng).toBeLessThanOrEqual(180);
    expect(viewport.minLat).toBeGreaterThanOrEqual(-90);
    expect(viewport.maxLat).toBeLessThanOrEqual(90);
  });
});
