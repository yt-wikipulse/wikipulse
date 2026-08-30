import type { LngLat, LngLatBounds } from "@yandex/ymaps3-types";
import { cellToBoundary } from "h3-js";

import type { ActiveHexagon } from "../../api/hexagons";
import type { PopoverPlacement } from "../CellPopover/CellPopover";

export type MapViewport = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  zoom: number;
};

/**
 * Потолок кэша границ ячеек. При переполнении кэш чистится целиком:
 * вытеснения по давности здесь нет, и если промахи пойдут по горячим
 * ячейкам, вместо чистки нужен LRU.
 */
const BOUNDARY_CACHE_CAP = 20_000;

const boundaryCache = new Map<string, LngLat[]>();

/**
 * Разворачивает кольцо ячейки, разорванное 180-м меридианом.
 *
 * `cellToBoundary` возвращает для такой ячейки долготы по обе стороны
 * разрыва (например `179.6` и `-178.9`), и полигон из них рисуется полосой
 * через всю карту: ymaps соединяет вершины кратчайшим путём по экрану,
 * а не по глобусу. Вершины сдвигаются на кратное 360 к первой, поэтому
 * долготы выходят за ±180 — карта повторяет мир и рисует такой полигон
 * там, где нужно.
 */
function unwrapRing(ring: LngLat[]): LngLat[] {
  const [referenceLng] = ring[0];

  return ring.map(([lng, lat]) => [
    lng - 360 * Math.round((lng - referenceLng) / 360),
    lat,
  ] as LngLat);
}

export function h3ToPolygon(h3: string): LngLat[] {
  const cached = boundaryCache.get(h3);

  if (cached) {
    return cached;
  }

  const boundary = cellToBoundary(h3).map(
    ([latitude, longitude]) => [longitude, latitude] as LngLat,
  );

  const ring = boundary.length > 0
    ? unwrapRing([...boundary, boundary[0]])
    : boundary;

  if (boundaryCache.size >= BOUNDARY_CACHE_CAP) {
    boundaryCache.clear();
  }

  boundaryCache.set(h3, ring);

  return ring;
}

export function toMultiPolygon(cells: string[]) {
  return {
    type: "MultiPolygon" as const,
    coordinates: cells.map((cell) => [h3ToPolygon(cell)]),
  };
}

/**
 * Доля экрана, которую догружаем за его краем. Она же — шаг сетки округления
 * bbox: пока карта не переехала на соседнюю клетку сетки, параметры запроса
 * не меняются и повторных запросов нет.
 */
const VIEWPORT_PAD = 0.25;

function padAxis(
  first: number,
  second: number,
  limit: number,
): [number, number] {
  const min = Math.min(first, second);
  const max = Math.max(first, second);

  const step = Math.max((max - min) * VIEWPORT_PAD, Number.EPSILON);

  return [
    Math.max(-limit, Math.floor(min / step) * step - step),
    Math.min(limit, Math.ceil(max / step) * step + step),
  ];
}

export function toViewport(
  bounds: LngLatBounds,
  zoom: number,
): MapViewport {
  const [[firstLng, firstLat], [secondLng, secondLat]] = bounds;

  const [minLng, maxLng] = padAxis(firstLng, secondLng, 180);
  const [minLat, maxLat] = padAxis(firstLat, secondLat, 90);

  return {
    minLng,
    minLat,
    maxLng,
    maxLat,
    zoom: Math.floor(zoom),
  };
}

/**
 * Число ступеней заливки. Ячейки одного цвета уезжают на карту одной
 * MultiPolygon-фичей, поэтому чем ступеней меньше, тем меньше фич.
 */
const FILL_LEVELS = 8;

export const SELECTED_FILL_COLOR = "#ffd500";

const POPOVER_EDGE_MARGIN = 0.2;

export function getPopoverPlacement(
  bounds: LngLatBounds,
  lat: number,
  lng: number,
): PopoverPlacement {
  const [[firstLng, firstLat], [secondLng, secondLat]] = bounds;

  const minLng = Math.min(firstLng, secondLng);
  const maxLng = Math.max(firstLng, secondLng);
  const minLat = Math.min(firstLat, secondLat);
  const maxLat = Math.max(firstLat, secondLat);

  const lngFraction = (lng - minLng) / (maxLng - minLng);
  const latFraction = (lat - minLat) / (maxLat - minLat);

  const vertical =
    latFraction > 1 - POPOVER_EDGE_MARGIN ? "bottom" : "top";

  const horizontal =
    lngFraction > 1 - POPOVER_EDGE_MARGIN
      ? "left"
      : lngFraction < POPOVER_EDGE_MARGIN
        ? "right"
        : "center";

  return `${vertical}-${horizontal}` as PopoverPlacement;
}

const STROKE_COLOR = "#ffffffd2";

function withAlpha(color: string, opacity: number) {
  if (opacity >= 1) {
    return color;
  }

  const alpha =
    color.length === 9 ? parseInt(color.slice(7, 9), 16) : 255;

  return (
    color.slice(0, 7) +
    Math.round(alpha * opacity)
      .toString(16)
      .padStart(2, "0")
  );
}

export function getFeatureStyle(fill: string, opacity: number) {
  return {
    cursor: "pointer",
    fill: withAlpha(fill, opacity),

    stroke: [
      {
        color: withAlpha(STROKE_COLOR, opacity),
        width: 1,
      },
    ],
  };
}

export function getFillColor(
  hexagon: ActiveHexagon,
  maxEvents: number,
) {
  const level = Math.round(
    (hexagon.events_count / maxEvents) * (FILL_LEVELS - 1),
  );

  const alpha = Math.round(90 + (level / (FILL_LEVELS - 1)) * 150)
    .toString(16)
    .padStart(2, "0");

  return `#ff7700${alpha}`;
}
