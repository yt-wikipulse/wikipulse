import { useEffect, useRef, useState } from "react";

import {
  getActiveHexagons,
  type ActiveHexagon,
  type GetActiveHexagonsParams,
} from "../../api/hexagons";
import { describeError } from "../../lib/errorMessage";

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
          error: describeError(error, "Не удалось загрузить данные карты"),
        }));
      } finally {
        isFetching = false;
      }
    }

    loadHexagonsRef.current = () => void loadHexagons();

    function loadWhenVisible() {
      if (!document.hidden) {
        void loadHexagons();
      }
    }

    const settleId = window.setTimeout(
      () => void loadHexagons(),
      VIEWPORT_SETTLE_MS,
    );

    const intervalId = window.setInterval(
      loadWhenVisible,
      POLL_INTERVAL_MS,
    );

    document.addEventListener("visibilitychange", loadWhenVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(settleId);
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", loadWhenVisible);
      activeController?.abort();
    };
  }, [viewport]);

  return {
    ...state,
    retry: () => loadHexagonsRef.current(),
  };
}
