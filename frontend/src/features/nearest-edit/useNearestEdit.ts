import { useCallback, useEffect, useState } from "react";

import { getActiveHexagons } from "../../api/hexagons";
import {
  requestGeoPosition,
  type GeoUnavailableReason,
} from "./geolocation";
import {
  bboxAround,
  pickNearest,
  type NearestEdit,
} from "./nearestEdit.helpers";

export type NearestEditState =
  | { status: "idle" }
  | { status: "requesting-geo" }
  | { status: "geo-denied" }
  | { status: "geo-unavailable"; reason: GeoUnavailableReason }
  | { status: "searching"; step: number; radiusKm: number }
  | { status: "found"; edit: NearestEdit }
  | { status: "empty" }
  | { status: "request-failed"; message: string };

type SearchStep = {
  radiusKm: number;
  zoom: number;
};

const SEARCH_STEPS: SearchStep[] = [
  { radiusKm: 55, zoom: 12 },
  { radiusKm: 220, zoom: 12 },
  { radiusKm: 880, zoom: 12 },
];

const IDLE_STATE: NearestEditState = { status: "idle" };

export function useNearestEdit(isOpen: boolean) {
  const [state, setState] = useState<NearestEditState>(IDLE_STATE);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function findNearestEdit() {
      setState({ status: "requesting-geo" });

      const geo = await requestGeoPosition();

      if (cancelled) {
        return;
      }

      if (geo.status !== "ok") {
        setState(geo);

        return;
      }

      for (const [index, step] of SEARCH_STEPS.entries()) {
        setState({
          status: "searching",
          step: index + 1,
          radiusKm: step.radiusKm,
        });

        try {
          const response = await getActiveHexagons(
            { ...bboxAround(geo.point, step.radiusKm), zoom: step.zoom },
            controller.signal,
          );

          if (cancelled) {
            return;
          }

          const nearest = pickNearest(response.hexagons, geo.point);

          if (nearest) {
            setState({ status: "found", edit: nearest });

            return;
          }
        } catch (error: unknown) {
          if (cancelled || controller.signal.aborted) {
            return;
          }

          setState({
            status: "request-failed",
            message:
              error instanceof Error
                ? error.message
                : "Не удалось найти ближайшую правку",
          });

          return;
        }
      }

      setState({ status: "empty" });
    }

    void findNearestEdit();

    return () => {
      cancelled = true;
      controller.abort();
      setState(IDLE_STATE);
    };
  }, [isOpen, attempt]);

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  return { state, retry };
}
