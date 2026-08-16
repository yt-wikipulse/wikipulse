import type { LngLat, LngLatBounds } from "@yandex/ymaps3-types";
import { cellToBoundary } from "h3-js";

import type { ActiveHexagon } from "../../api/hexagons";

export type MapViewport = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  zoom: number;
};

export function h3ToPolygon(h3: string): LngLat[] {
  const boundary = cellToBoundary(h3).map(
    ([latitude, longitude]) => [longitude, latitude] as LngLat,
  );

  return boundary.length > 0
    ? [...boundary, boundary[0]]
    : boundary;
}

export function toViewport(
  bounds: LngLatBounds,
  zoom: number,
): MapViewport {
  const [[firstLng, firstLat], [secondLng, secondLat]] = bounds;

  return {
    minLng: Math.min(firstLng, secondLng),
    minLat: Math.min(firstLat, secondLat),
    maxLng: Math.max(firstLng, secondLng),
    maxLat: Math.max(firstLat, secondLat),
    zoom: Math.floor(zoom),
  };
}

export function getFillColor(
  hexagon: ActiveHexagon,
  maxEvents: number,
  selectedH3: string | null,
) {
  if (hexagon.h3_index === selectedH3) {
    return "#ff5f1fe6";
  }

  const intensity = hexagon.events_count / maxEvents;

  const alpha = Math.round(90 + intensity * 150)
    .toString(16)
    .padStart(2, "0");

  return `#0075ff${alpha}`;
}
