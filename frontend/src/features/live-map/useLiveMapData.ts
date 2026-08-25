import { useEffect, useRef, useState } from "react";

import {
  getActiveHexagons,
  type ActiveHexagon,
  type GetActiveHexagonsParams,
} from "../../api/hexagons";

const POLL_INTERVAL_MS = 2_500;

const VIEWPORT_SETTLE_MS = 120;

type LiveMapDataState = {
  hexagons: ActiveHexagon[];
  loading: boolean;
  isBackgroundRefreshing: boolean;
  error: string | null;
};

const INITIAL_STATE: LiveMapDataState = {
  hexagons: [],
  loading: true,
  isBackgroundRefreshing: false,
  error: null,
};

export function useLiveMapData(
  viewport: GetActiveHexagonsParams | null,
) {
  const [state, setState] =
    useState<LiveMapDataState>(INITIAL_STATE);

  const loadHexagonsRef = useRef<() => void>(() => {});

  const hasDataRef = useRef(false);

  useEffect(() => {
    if (!viewport) {
      return;
    }

    const requestViewport = viewport;
    let cancelled = false;
    let isFetching = false;
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
        loading: !hasDataRef.current,
        isBackgroundRefreshing: hasDataRef.current,
      }));

      try {
        const response = await getActiveHexagons(
          requestViewport,
          controller.signal,
        );

        if (cancelled) {
          return;
        }

        hasDataRef.current = true;

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

    loadHexagonsRef.current = () => void loadHexagons();

    let settleId: number | undefined;

    if (hasDataRef.current) {
      settleId = window.setTimeout(
        () => void loadHexagons(),
        VIEWPORT_SETTLE_MS,
      );
    } else {
      void loadHexagons();
    }

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

  return {
    ...state,
    retry: () => loadHexagonsRef.current(),
  };
}
