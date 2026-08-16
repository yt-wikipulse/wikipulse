import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  BehaviorType,
  LngLat,
} from "@yandex/ymaps3-types";
import {
  cellToBoundary,
  cellToLatLng,
  getResolution,
  latLngToCell,
} from "h3-js";

import type { ActiveHexagon } from "../../api/hexagons";
import { CellPopover } from "../CellPopover/CellPopover";
import { mapCustomization } from "./mapCustomization";
import { toViewport, type MapViewport } from "./viewport";

import styles from "./LiveMap.module.scss";

export type { MapViewport };

type LiveMapProps = {
  hexagons: ActiveHexagon[];
  selectedH3: string | null;
  onSelectedH3Change: (h3: string | null) => void;
  onViewportChange: (viewport: MapViewport) => void;
};

const INITIAL_LOCATION = {
  center: [37.6176, 55.7558] as LngLat,
  zoom: 7,
};

const MAP_BEHAVIORS: BehaviorType[] = [
  "drag",
  "pinchZoom",
  "scrollZoom",
  "dblClick",
  "magnifier",
  "oneFingerZoom",
  "mouseTilt",
  "panTilt",
];

const FILL_LEVELS = 8;
const SELECTED_FILL = "#ff5f1fe6";

const boundaryCache = new Map<string, LngLat[]>();

function h3ToPolygon(h3: string): LngLat[] {
  const cached = boundaryCache.get(h3);

  if (cached) {
    return cached;
  }

  const boundary = cellToBoundary(h3).map(
    ([latitude, longitude]) =>
      [longitude, latitude] as LngLat,
  );

  const ring =
    boundary.length > 0
      ? [...boundary, boundary[0]]
      : boundary;

  boundaryCache.set(h3, ring);

  return ring;
}

function getFillColor(
  hexagon: ActiveHexagon,
  maxEvents: number,
  selectedH3: string | null,
) {
  if (hexagon.h3_index === selectedH3) {
    return SELECTED_FILL;
  }

  const level = Math.round(
    (hexagon.events_count / maxEvents) *
      (FILL_LEVELS - 1),
  );

  const alpha = Math.round(
    90 + (level / (FILL_LEVELS - 1)) * 150,
  )
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

  const [popoverElement] = useState(() =>
    document.createElement("div"),
  );

  // Слушатель карты создаётся один раз, данные читает через ref.
  const hexagonsRef = useRef(hexagons);

  const maxEvents = Math.max(
    1,
    ...hexagons.map(
      (hexagon) => hexagon.events_count,
    ),
  );

  const selectedHexagon = selectedH3
    ? (hexagons.find(
      (hexagon) => hexagon.h3_index === selectedH3,
    ) ?? null)
    : null;

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
            behaviors: MAP_BEHAVIORS,
          },
        );

        map.addChild(
          new ymaps3.YMapDefaultSchemeLayer({
            customization: mapCustomization,
          }),
        );

        map.addChild(
          new ymaps3.YMapDefaultFeaturesLayer({}),
        );

        const { YMapZoomControl, YMapGeolocationControl } =
          await ymaps3.import("@yandex/ymaps3-controls@0.0.1");

        if (disposed) {
          return;
        }

        const controls = new ymaps3.YMapControls({
          position: "right",
        });

        controls.addChild(new YMapZoomControl({}));
        controls.addChild(new YMapGeolocationControl({}));
        map.addChild(controls);

        map.addChild(
          new ymaps3.YMapListener({
            onClick: (_object, event) => {
              const active = hexagonsRef.current;
              const coordinates = event?.coordinates;

              if (!coordinates || active.length === 0) {
                onSelectedH3Change(null);
                return;
              }

              const [lng, lat] = coordinates;

              const cell = latLngToCell(
                lat,
                lng,
                getResolution(active[0].h3_index),
              );

              onSelectedH3Change(
                active.some(
                  (hexagon) => hexagon.h3_index === cell,
                )
                  ? cell
                  : null,
              );
            },

            // Грузим и во время движения: округлённый bbox меняется
            // раз в четверть экрана, лишних запросов не будет.
            onUpdate: ({ location }) => {
              onViewportChange(
                toViewport(location.bounds, location.zoom),
              );
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

      featuresRef.current = [];
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, [onViewportChange, onSelectedH3Change]);

  useEffect(() => {
    hexagonsRef.current = hexagons;

    const map = mapRef.current;

    if (!map) {
      return;
    }

    // Одна фича на цвет, а не на ячейку: тысячи YMapFeature карта не тянет.
    const groups = new Map<string, LngLat[][][]>();

    for (const hexagon of hexagons) {
      const fill = getFillColor(
        hexagon,
        maxEvents,
        selectedH3,
      );

      const polygon = [
        h3ToPolygon(hexagon.h3_index),
      ];

      const group = groups.get(fill);

      if (group) {
        group.push(polygon);
      } else {
        groups.set(fill, [polygon]);
      }
    }

    const features = [...groups].map(
      ([fill, coordinates]) => {
        const feature = new ymaps3.YMapFeature({
          geometry: {
            type: "MultiPolygon",
            coordinates,
          },

          style: {
            cursor: "pointer",
            fill,

            stroke: [
              {
                color: "#ffffffd2",
                width: 1,
              },
            ],
          },
        });

        map.addChild(feature);

        return feature;
      },
    );

    for (const feature of featuresRef.current) {
      map.removeChild(feature);
    }

    featuresRef.current = features;
  }, [
    hexagons,
    selectedH3,
    maxEvents,
    mapVersion,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !selectedH3) {
      return;
    }

    const [lat, lng] = cellToLatLng(selectedH3);

    const marker = new ymaps3.YMapMarker(
      {
        coordinates: [lng, lat] as LngLat,
        zIndex: 1000,
      },
      popoverElement,
    );

    map.addChild(marker);

    return () => {
      if (mapRef.current === map) {
        map.removeChild(marker);
      }
    };
  }, [selectedH3, mapVersion, popoverElement]);

  return (
    <>
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

      {selectedH3 &&
        createPortal(
          <CellPopover
            hexagon={selectedHexagon}
            onClose={() => onSelectedH3Change(null)}
          />,
          popoverElement,
        )}
    </>
  );
}
