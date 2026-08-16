import {
  useCallback,
  useState,
} from "react";

import {
  LiveMap,
  type MapViewport,
} from "../components/LiveMap/LiveMap";
import { MapStatus } from "../components/MapStatus/MapStatus";
import { useLiveMapData } from "../features/live-map/useLiveMapData";

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

  const {
    hexagons,
    loading,
    isBackgroundRefreshing,
    error,
    retry,
  } = useLiveMapData(viewport);

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
          selectedH3={selectedH3}
          onSelectedH3Change={setSelectedH3}
          onViewportChange={handleViewportChange}
        />
      </section>
    </main>
  );
}
