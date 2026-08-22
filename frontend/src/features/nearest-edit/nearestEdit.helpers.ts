import { cellToLatLng } from "h3-js";

import type { ActiveHexagon } from "../../api/hexagons";

export type GeoPoint = {
  lat: number;
  lng: number;
};

export type NearestEdit = {
  title: string;
  url: string;
  distanceKm: number;
  h3Index: string;
  alsoNearbyCount: number;
};

export type Bbox = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

const EARTH_RADIUS_KM = 6371;

const KM_PER_LAT_DEGREE = 111.32;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function haversineKm(from: GeoPoint, to: GeoPoint): number {
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);

  const chord =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(chord));
}

const MIN_LNG_SCALE = 0.01;

export function bboxAround(center: GeoPoint, radiusKm: number): Bbox {
  const halfLat = radiusKm / KM_PER_LAT_DEGREE;

  const lngScale = Math.max(
    Math.cos(toRadians(center.lat)),
    MIN_LNG_SCALE,
  );

  const halfLng = halfLat / lngScale;

  return {
    minLng: clamp(center.lng - halfLng, -180, 180),
    minLat: clamp(center.lat - halfLat, -90, 90),
    maxLng: clamp(center.lng + halfLng, -180, 180),
    maxLat: clamp(center.lat + halfLat, -90, 90),
  };
}

export function pickNearest(
  hexagons: ActiveHexagon[],
  user: GeoPoint,
): NearestEdit | null {
  let nearest: NearestEdit | null = null;

  for (const hexagon of hexagons) {
    const event = hexagon.events[0];

    if (!event) {
      continue;
    }

    const [lat, lng] = cellToLatLng(hexagon.h3_index);

    const distanceKm = haversineKm(user, { lat, lng });

    if (nearest && nearest.distanceKm <= distanceKm) {
      continue;
    }

    nearest = {
      title: event.title,
      url: event.url,
      distanceKm,
      h3Index: hexagon.h3_index,
      alsoNearbyCount: Math.max(hexagon.events_count - 1, 0),
    };
  }

  return nearest;
}

export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} м`;
  }

  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)} км`;
  }

  return `${Math.round(distanceKm)} км`;
}
