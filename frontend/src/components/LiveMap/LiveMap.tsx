import { useEffect, useRef, useState } from "react";
import type {
  LngLat,
  LngLatBounds,
} from "@yandex/ymaps3-types";
import { cellToBoundary } from "h3-js";

import type { ActiveHexagon } from "../../api/hexagons";

import styles from "./LiveMap.module.scss";

export type MapViewport = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  zoom: number;
};

type LiveMapProps = {
  hexagons: ActiveHexagon[];
  selectedH3: string | null;
  onSelectedH3Change: (h3: string) => void;
  onViewportChange: (viewport: MapViewport) => void;
};

const INITIAL_LOCATION = {
  center: [37.6176, 55.7558] as LngLat,
  zoom: 7,
};

const VIEWPORT_DEBOUNCE_MS = 400;

function h3ToPolygon(h3: string): LngLat[] {
  const boundary = cellToBoundary(h3).map(
    ([latitude, longitude]) =>
      [longitude, latitude] as LngLat,
  );

  return boundary.length > 0
    ? [...boundary, boundary[0]]
    : boundary;
}

function toViewport(
  bounds: LngLatBounds,
  zoom: number,
): MapViewport {
  const [[firstLng, firstLat], [secondLng, secondLat]] =
    bounds;

  return {
    minLng: Math.min(firstLng, secondLng),
    minLat: Math.min(firstLat, secondLat),
    maxLng: Math.max(firstLng, secondLng),
    maxLat: Math.max(firstLat, secondLat),
    zoom: Math.floor(zoom),
  };
}

function getFillColor(
  hexagon: ActiveHexagon,
  maxEvents: number,
  selectedH3: string | null,
) {
  if (hexagon.h3_index === selectedH3) {
    return "#ff5f1fe6";
  }

  const intensity =
    hexagon.events_count / maxEvents;

  const alpha = Math.round(90 + intensity * 150)
    .toString(16)
    .padStart(2, "0");

  return `#0075ff${alpha}`;
}

export function LiveMap({
  hexagons,
  selectedH3,
  onSelectedH3Change,
  onViewportChange,
}: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const mapRef = useRef<
    InstanceType<typeof ymaps3.YMap> | null
  >(null);

  const featuresRef = useRef<
    InstanceType<typeof ymaps3.YMapFeature>[]
  >([]);

  const [mapVersion, setMapVersion] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);

  const viewportDebounceRef = useRef<number | null>(null);

  const maxEvents = Math.max(
    1,
    ...hexagons.map(
      (hexagon) => hexagon.events_count,
    ),
  );

  useEffect(() => {
    let disposed = false;

    async function createMap() {
      try {
        await ymaps3.ready;

        if (disposed || !containerRef.current) {
          return;
        }

        const map = new ymaps3.YMap(
          containerRef.current,
          {
            location: INITIAL_LOCATION,
          },
        );

        map.addChild(
          new ymaps3.YMapDefaultSchemeLayer({}),
        );

        map.addChild(
          new ymaps3.YMapDefaultFeaturesLayer({}),
        );

        map.addChild(
          new ymaps3.YMapListener({
            onUpdate: ({ location, mapInAction }) => {
              if (mapInAction) {
                return;
              }

              const nextViewport = toViewport(
                location.bounds,
                location.zoom,
              );

              if (viewportDebounceRef.current !== null) {
                window.clearTimeout(viewportDebounceRef.current);
              }

              viewportDebounceRef.current = window.setTimeout(() => {
                viewportDebounceRef.current = null;
                onViewportChange(nextViewport);
              }, VIEWPORT_DEBOUNCE_MS);
            },
          }),
        );

        mapRef.current = map;

        onViewportChange(
          toViewport(map.bounds, map.zoom),
        );

        setMapVersion((version) => version + 1);
      } catch {
        if (!disposed) {
          setMapError("Не удалось загрузить карту");
        }
      }
    }

    void createMap();

    return () => {
      disposed = true;

      if (viewportDebounceRef.current !== null) {
        window.clearTimeout(viewportDebounceRef.current);
        viewportDebounceRef.current = null;
      }

      featuresRef.current = [];
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, [onViewportChange]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    for (const feature of featuresRef.current) {
      map.removeChild(feature);
    }

    const features = hexagons.map((hexagon) => {
      const feature = new ymaps3.YMapFeature({
        id: hexagon.h3_index,

        geometry: {
          type: "Polygon",
          coordinates: [
            h3ToPolygon(hexagon.h3_index),
          ],
        },

        style: {
          cursor: "pointer",

          fill: getFillColor(
            hexagon,
            maxEvents,
            selectedH3,
          ),

          stroke: [
            {
              color: "#ffffffd2",
              width: 1,
            },
          ],
        },

        onClick: () => {
          onSelectedH3Change(
            hexagon.h3_index,
          );
        },
      });

      map.addChild(feature);

      return feature;
    });

    featuresRef.current = features;
  }, [
    hexagons,
    selectedH3,
    maxEvents,
    mapVersion,
    onSelectedH3Change,
  ]);

  return (
    <div
      ref={containerRef}
      className={styles.liveMap}
    >
      {mapError && (
        <p
          className={styles.liveMap__error}
          role="alert"
        >
          {mapError}
        </p>
      )}
    </div>
  );
}
