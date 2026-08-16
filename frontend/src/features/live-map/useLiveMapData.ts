import { useEffect, useState } from "react";

import {
  getActiveHexagons,
  type ActiveHexagon,
  type GetActiveHexagonsParams,
} from "../../api/hexagons";

const POLL_INTERVAL_MS = 2_500;

// Быстрый флик успевает пересечь несколько клеток сетки bbox — ждём,
// пока карта осядет, и грузим только последнюю.
const VIEWPORT_SETTLE_MS = 120;

type LiveMapDataState = {
  hexagons: ActiveHexagon[];
  loading: boolean;
  isBackgroundRefreshing: boolean;
  error: string | null;
};

const INITIAL_STATE: LiveMapDataState = {
  hexagons: [],
  loading: false,
  isBackgroundRefreshing: false,
  error: null,
};

export function useLiveMapData(
  viewport: GetActiveHexagonsParams | null,
) {
  const [state, setState] =
    useState<LiveMapDataState>(INITIAL_STATE);

  useEffect(() => {
    if (!viewport) {
      return;
    }

    const requestViewport = viewport;
    let cancelled = false;
    let isFetching = false;
    let hasData = false;
    let activeController: AbortController | null = null;

    async function loadHexagons() {
      if (isFetching) {
        return;
      }

      isFetching = true;
      const controller = new AbortController();
      activeController = controller;

      setState((current) => ({
        ...current,
        loading: !hasData,
        isBackgroundRefreshing: hasData,
      }));

      try {
        const response = await getActiveHexagons(
          requestViewport,
          controller.signal,
        );

        if (cancelled) {
          return;
        }

        hasData = true;

        setState({
          hexagons: response.hexagons,
          loading: false,
          isBackgroundRefreshing: false,
          error: null,
        });
      } catch (error: unknown) {
        if (cancelled || controller.signal.aborted) {
          return;
        }

        setState((current) => ({
          ...current,
          loading: false,
          isBackgroundRefreshing: false,
          error:
            error instanceof Error
              ? error.message
              : "Не удалось загрузить данные карты",
        }));
      } finally {
        isFetching = false;
      }
    }

    const settleId = window.setTimeout(
      () => void loadHexagons(),
      VIEWPORT_SETTLE_MS,
    );

    const intervalId = window.setInterval(
      () => void loadHexagons(),
      POLL_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      window.clearTimeout(settleId);
      window.clearInterval(intervalId);
      activeController?.abort();
    };
  }, [viewport]);

  return state;
}
