import { describe, expect, it } from "vitest";
import { cellToBoundary, latLngToCell } from "h3-js";

import type { ActiveHexagon } from "../../api/hexagons";
import {
  getFillColor,
  getPopoverPlacement,
  h3ToPolygon,
  SELECTED_FILL_COLOR,
  toMultiPolygon,
  toViewport,
} from "./LiveMap.helpers";

describe("toViewport", () => {
  it("нормализует bbox независимо от порядка углов и floor'ит zoom", () => {
    expect(toViewport([[10, 20], [5, 15]], 7.9)).toEqual(
      toViewport([[5, 15], [10, 20]], 7.9),
    );

    expect(toViewport([[10, 20], [5, 15]], 7.9).zoom).toBe(7);
  });

  it("запрашивает область с запасом за краем экрана", () => {
    const viewport = toViewport([[37, 57], [41, 55]], 7);

    expect(viewport.minLng).toBeLessThan(37);
    expect(viewport.maxLng).toBeGreaterThan(41);
    expect(viewport.minLat).toBeLessThan(55);
    expect(viewport.maxLat).toBeGreaterThan(57);
  });

  it("не меняет bbox, пока карта не переехала в соседнюю клетку", () => {
    expect(toViewport([[37.1, 57.1], [41.1, 55.1]], 7)).toEqual(
      toViewport([[37.6, 57.3], [41.6, 55.3]], 7),
    );
  });

  it("не вылезает за границы координат", () => {
    const viewport = toViewport([[-179, 89], [179, -89]], 2);

    expect(viewport.minLng).toBeGreaterThanOrEqual(-180);
    expect(viewport.maxLng).toBeLessThanOrEqual(180);
    expect(viewport.minLat).toBeGreaterThanOrEqual(-90);
    expect(viewport.maxLat).toBeLessThanOrEqual(90);
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

  it("разворачивает кольцо ячейки на 180-м меридиане в непрерывное", () => {
    const polygon = h3ToPolygon("832261fffffffff");

    const gaps = polygon
      .slice(1)
      .map(([lng], index) => Math.abs(lng - polygon[index][0]));

    const longitudes = polygon.map(([lng]) => lng);

    expect(Math.max(...gaps)).toBeLessThan(180);
    expect(
      Math.max(...longitudes) > 180 || Math.min(...longitudes) < -180,
    ).toBe(true);
  });
});

describe("toMultiPolygon", () => {
  const first = latLngToCell(55.7558, 37.6176, 9);
  const second = latLngToCell(59.9386, 30.3141, 9);

  it("оборачивает каждую ячейку в отдельное кольцо MultiPolygon", () => {
    const geometry = toMultiPolygon([first, second]);

    expect(geometry.type).toBe("MultiPolygon");
    expect(geometry.coordinates).toEqual([
      [h3ToPolygon(first)],
      [h3ToPolygon(second)],
    ]);
  });

  it("пустой список даёт пустую геометрию — так из слоя вырезается выбранная ячейка", () => {
    expect(toMultiPolygon([]).coordinates).toEqual([]);
  });
});

describe("getFillColor", () => {
  const hexagon: ActiveHexagon = {
    h3_index: "891f1d48947ffff",
    events_count: 5,
    events: [],
  };

  it("максимальная интенсивность (events_count === maxEvents) даёт максимальную alpha", () => {
    expect(getFillColor(hexagon, 5)).toBe("#ff7700f0");
  });

  it("нулевая интенсивность даёт минимальную alpha", () => {
    expect(
      getFillColor({ ...hexagon, events_count: 0 }, 5),
    ).toBe("#ff77005a");
  });

  it("не красит выбранную ячейку — подсветка рисуется отдельной фичей", () => {
    expect(getFillColor(hexagon, 5)).not.toBe(SELECTED_FILL_COLOR);
  });
});

describe("getPopoverPlacement", () => {
  const bounds: [[number, number], [number, number]] = [
    [37, 55],
    [39, 57],
  ];

  it("по умолчанию — сверху по центру, точка далеко от краёв", () => {
    expect(getPopoverPlacement(bounds, 56, 38)).toBe("top-center");
  });

  it("прыгает влево, когда точка у правого края viewport", () => {
    expect(getPopoverPlacement(bounds, 56, 38.99)).toBe("top-left");
  });

  it("прыгает вправо, когда точка у левого края viewport", () => {
    expect(getPopoverPlacement(bounds, 56, 37.01)).toBe("top-right");
  });

  it("прыгает вниз, когда точка у верхнего края viewport", () => {
    expect(getPopoverPlacement(bounds, 56.99, 38)).toBe("bottom-center");
  });

  it("комбинирует обе оси одновременно", () => {
    expect(getPopoverPlacement(bounds, 56.99, 38.99)).toBe(
      "bottom-left",
    );
  });

  it("не зависит от порядка углов bounds", () => {
    const reversedBounds: [[number, number], [number, number]] = [
      [39, 57],
      [37, 55],
    ];

    expect(getPopoverPlacement(bounds, 56, 38)).toBe(
      getPopoverPlacement(reversedBounds, 56, 38),
    );
  });
});
