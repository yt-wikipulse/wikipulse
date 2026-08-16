import type { LngLatBounds } from "@yandex/ymaps3-types";

export type MapViewport = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  zoom: number;
};

// Доля экрана, которую догружаем за краем. Она же — шаг сетки округления
// bbox: пока карта не переехала на соседнюю клетку, запрос не меняется.
const VIEWPORT_PAD = 0.25;

function padAxis(
  first: number,
  second: number,
  limit: number,
): [number, number] {
  const min = Math.min(first, second);
  const max = Math.max(first, second);

  const step = Math.max(
    (max - min) * VIEWPORT_PAD,
    Number.EPSILON,
  );

  return [
    Math.max(-limit, Math.floor(min / step) * step - step),
    Math.min(limit, Math.ceil(max / step) * step + step),
  ];
}

export function toViewport(
  bounds: LngLatBounds,
  zoom: number,
): MapViewport {
  const [[firstLng, firstLat], [secondLng, secondLat]] =
    bounds;

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
