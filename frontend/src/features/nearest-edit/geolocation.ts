import type { GeoPoint } from "./nearestEdit.helpers";

export type GeoUnavailableReason =
  | "unsupported"
  | "insecure-context"
  | "timeout"
  | "position-failed";

export type GeoResult =
  | { status: "ok"; point: GeoPoint }
  | { status: "geo-denied" }
  | { status: "geo-unavailable"; reason: GeoUnavailableReason };

const GEO_TIMEOUT_MS = 10_000;

const GEO_MAX_AGE_MS = 60_000;

const PERMISSION_DENIED = 1;

const POSITION_UNAVAILABLE = 2;

const TIMEOUT = 3;

function toFailure(error: GeolocationPositionError): GeoResult {
  switch (error.code) {
    case PERMISSION_DENIED:
      return { status: "geo-denied" };

    case TIMEOUT:
      return { status: "geo-unavailable", reason: "timeout" };

    case POSITION_UNAVAILABLE:
    default:
      return { status: "geo-unavailable", reason: "position-failed" };
  }
}

export async function requestGeoPosition(): Promise<GeoResult> {
  if (!("geolocation" in navigator)) {
    return { status: "geo-unavailable", reason: "unsupported" };
  }

  if (!window.isSecureContext) {
    return { status: "geo-unavailable", reason: "insecure-context" };
  }

  return new Promise<GeoResult>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          status: "ok",
          point: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
        }),
      (error) => resolve(toFailure(error)),
      {
        enableHighAccuracy: false,
        timeout: GEO_TIMEOUT_MS,
        maximumAge: GEO_MAX_AGE_MS,
      },
    );
  });
}
