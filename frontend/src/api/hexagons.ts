import { requestJson } from "./http";

export type HexagonEvent = {
  id: string;
  title: string;
  url: string;
  length_update: number;
  diff_url: string;
  event_ts: number;
};

export type ActiveHexagon = {
  h3_index: string;
  events_count: number;
  events: HexagonEvent[];
};

export type ActiveHexagonsResponse = {
  hexagons: ActiveHexagon[];
};

export type GetActiveHexagonsParams = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  zoom: number;
};

export function getActiveHexagons(
  params: GetActiveHexagonsParams,
  signal?: AbortSignal,
): Promise<ActiveHexagonsResponse> {
  const query = new URLSearchParams({
    min_lng: String(params.minLng),
    min_lat: String(params.minLat),
    max_lng: String(params.maxLng),
    max_lat: String(params.maxLat),
    zoom: String(params.zoom),
  });

  return requestJson<ActiveHexagonsResponse>(
    `/api/v1/hexagons/active?${query}`,
    signal,
  );
}
