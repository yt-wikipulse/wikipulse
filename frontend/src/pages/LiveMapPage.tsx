import {
  useCallback,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";

import { useAppShellContext } from "../app/appShellContext";
import {
  LiveMap,
  type MapFocus,
  type MapViewport,
} from "../components/LiveMap/LiveMap";
import { MapStatus } from "../components/MapStatus/MapStatus";
import { NearestEditPanel } from "../components/NearestEditPanel/NearestEditPanel";
import { useLiveMapData } from "../features/live-map/useLiveMapData";
import { useNearestEdit } from "../features/nearest-edit/useNearestEdit";

import styles from "./LiveMapPage.module.scss";

function isSameViewport(
  current: MapViewport | null,
  next: MapViewport,
) {
  return (
    current !== null &&
    current.minLng === next.minLng &&
    current.minLat === next.minLat &&
    current.maxLng === next.maxLng &&
    current.maxLat === next.maxLat &&
    current.zoom === next.zoom
  );
}

export function LiveMapPage() {
  const [viewport, setViewport] =
    useState<MapViewport | null>(null);

  const [selectedH3, setSelectedH3] =
    useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const focusH3 = searchParams.get("h3");

  const {
    hexagons,
    loading,
    isBackgroundRefreshing,
    error,
    retry,
  } = useLiveMapData(viewport);

  const { isNearestEditOpen, closeNearestEdit } =
    useAppShellContext();

  const {
    state: nearestEditState,
    retry: retryNearestEdit,
  } = useNearestEdit(isNearestEditOpen);

  const [mapFocus, setMapFocus] =
    useState<MapFocus | null>(null);

  const focusTokenRef = useRef(0);

  const handleShowOnMap = useCallback(
    (h3Index: string, zoom: number) => {
      focusTokenRef.current += 1;

      setMapFocus({
        h3Index,
        zoom,
        token: focusTokenRef.current,
      });
    },
    [],
  );

  const handleViewportChange = useCallback(
    (nextViewport: MapViewport) => {
      setViewport((currentViewport) => {
        if (
          isSameViewport(
            currentViewport,
            nextViewport,
          )
        ) {
          return currentViewport;
        }

        return nextViewport;
      });
    },
    [],
  );

  return (
    <main className={styles.liveMapPage}>
      <section
        className={styles.liveMapPage__map}
      >
        <MapStatus
          loading={loading}
          isBackgroundRefreshing={isBackgroundRefreshing}
          error={error}
          cellCount={hexagons.length}
          onRetry={retry}
        />

        <LiveMap
          hexagons={hexagons}
          focusH3={focusH3}
          selectedH3={selectedH3}
          focus={mapFocus}
          onSelectedH3Change={setSelectedH3}
          onViewportChange={handleViewportChange}
        />

        <NearestEditPanel
          state={nearestEditState}
          onRetry={retryNearestEdit}
          onShowOnMap={handleShowOnMap}
          onClose={closeNearestEdit}
        />
      </section>
    </main>
  );
}
