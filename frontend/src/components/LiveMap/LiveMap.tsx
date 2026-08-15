import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  BehaviorType,
  LngLat,
  LngLatBounds,
} from "@yandex/ymaps3-types";
import { cellToBoundary, cellToLatLng } from "h3-js";

import type { ActiveHexagon } from "../../api/hexagons";
import { CellPopover } from "../CellPopover/CellPopover";
import { mapCustomization } from "./mapCustomization";

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
  onSelectedH3Change: (h3: string | null) => void;
  onViewportChange: (viewport: MapViewport) => void;
};

const INITIAL_LOCATION = {
  center: [37.6176, 55.7558] as LngLat,
  zoom: 7,
};

const VIEWPORT_DEBOUNCE_MS = 400;

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

  const [popoverElement] = useState(() =>
    document.createElement("div"),
  );

  const viewportDebounceRef = useRef<number | null>(null);

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
            onClick: (object) => {
              if (!object) {
                onSelectedH3Change(null);
              }
            },

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
  }, [onViewportChange, onSelectedH3Change]);

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
