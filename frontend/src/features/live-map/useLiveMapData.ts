import { useEffect, useState } from "react";

import {
  getActiveHexagons,
  type ActiveHexagon,
  type GetActiveHexagonsParams,
} from "../../api/hexagons";

type LiveMapDataState = {
  hexagons: ActiveHexagon[];
  loading: boolean;
  error: string | null;
};

const INITIAL_STATE: LiveMapDataState = {
  hexagons: [],
  loading: false,
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
    const controller = new AbortController();
    let cancelled = false;

    async function loadHexagons() {
      setState((current) => ({
        ...current,
        loading: true,
        error: null,
      }));

      try {
        const response = await getActiveHexagons(
          requestViewport,
          controller.signal,
        );

        if (cancelled) {
          return;
        }

        setState({
          hexagons: response.hexagons,
          loading: false,
          error: null,
        });
      } catch (error: unknown) {
        if (cancelled || controller.signal.aborted) {
          return;
        }

        setState((current) => ({
          ...current,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Не удалось загрузить данные карты",
        }));
      }
    }

    void loadHexagons();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [viewport]);

  return state;
}
