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

const BOUNDARY_CACHE_CAP = 20_000;

const boundaryCache = new Map<string, LngLat[]>();

export function h3ToPolygon(h3: string): LngLat[] {
  const cached = boundaryCache.get(h3);

  if (cached) {
    return cached;
  }

  const boundary = cellToBoundary(h3).map(
    ([latitude, longitude]) => [longitude, latitude] as LngLat,
  );

  const ring = boundary.length > 0
    ? [...boundary, boundary[0]]
    : boundary;

  if (boundaryCache.size >= BOUNDARY_CACHE_CAP) {
    boundaryCache.clear();
  }

  boundaryCache.set(h3, ring);

  return ring;
}

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

export function getFillColor(
  hexagon: ActiveHexagon,
  maxEvents: number,
  selectedH3: string | null,
) {
  if (hexagon.h3_index === selectedH3) {
    return SELECTED_FILL_COLOR;
  }

  const level = Math.round(
    (hexagon.events_count / maxEvents) * (FILL_LEVELS - 1),
  );

  const alpha = Math.round(90 + (level / (FILL_LEVELS - 1)) * 150)
    .toString(16)
    .padStart(2, "0");

  return `#ff7700${alpha}`;
}
