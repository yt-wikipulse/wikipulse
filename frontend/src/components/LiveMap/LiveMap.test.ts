import { describe, expect, it } from "vitest";
import { cellToBoundary, latLngToCell } from "h3-js";

import type { ActiveHexagon } from "../../api/hexagons";
import { getFillColor, h3ToPolygon, toViewport } from "./LiveMap.helpers";

describe("toViewport", () => {
  it("нормализует bbox независимо от порядка углов и floor'ит zoom", () => {
    expect(toViewport([[10, 20], [5, 15]], 7.9)).toEqual({
      minLng: 5,
      minLat: 15,
      maxLng: 10,
      maxLat: 20,
      zoom: 7,
    });
  });

  it("работает и когда первый угол уже минимальный", () => {
    expect(toViewport([[5, 15], [10, 20]], 3)).toEqual({
      minLng: 5,
      minLat: 15,
      maxLng: 10,
      maxLat: 20,
      zoom: 3,
    });
  });
});

describe("h3ToPolygon", () => {
  it("переводит [lat,lng] границы h3-js в [lng,lat] и замыкает кольцо", () => {
    const h3Index = latLngToCell(55.7558, 37.6176, 9);
    const rawBoundary = cellToBoundary(h3Index);

    const polygon = h3ToPolygon(h3Index);

    expect(polygon).toHaveLength(rawBoundary.length + 1);
    expect(polygon[0]).toEqual([rawBoundary[0]?.[1], rawBoundary[0]?.[0]]);
    expect(polygon[polygon.length - 1]).toEqual(polygon[0]);
  });
});

describe("getFillColor", () => {
  const hexagon: ActiveHexagon = {
    h3_index: "891f1d48947ffff",
    events_count: 5,
    events: [],
  };

  it("красит выбранную ячейку в акцентный цвет независимо от интенсивности", () => {
    expect(getFillColor(hexagon, 5, hexagon.h3_index)).toBe("#ff5f1fe6");
  });

  it("максимальная интенсивность (events_count === maxEvents) даёт максимальную alpha", () => {
    expect(getFillColor(hexagon, 5, null)).toBe("#0075fff0");
  });

  it("нулевая интенсивность даёт минимальную alpha", () => {
    expect(
      getFillColor({ ...hexagon, events_count: 0 }, 5, null),
    ).toBe("#0075ff5a");
  });
});
