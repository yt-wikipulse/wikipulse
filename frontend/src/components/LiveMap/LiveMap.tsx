import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BehaviorType, LngLat, LngLatBounds } from "@yandex/ymaps3-types";
import { cellToLatLng, getResolution, latLngToCell } from "h3-js";

import type { ActiveHexagon } from "../../api/hexagons";
import { CellPopover, type PopoverPlacement } from "../CellPopover/CellPopover";
import {
  getFillColor,
  getPopoverPlacement,
  h3ToPolygon,
  toViewport,
  type MapViewport,
} from "./LiveMap.helpers";
import { mapCustomization } from "./mapCustomization";

import { useMediaQuery } from "../../hooks/useMediaQuery";
import styles from "./LiveMap.module.scss";

export type { MapViewport };

export type MapFocus = {
  h3Index: string;
  token: number;
};

type LiveMapProps = {
  hexagons: ActiveHexagon[];
  focusH3: string | null;
  selectedH3: string | null;
  focus?: MapFocus | null;
  onSelectedH3Change: (h3: string | null) => void;
  onViewportChange: (viewport: MapViewport) => void;
};

const INITIAL_LOCATION = {
  center: [37.6176, 55.7558] as LngLat,
  zoom: 7,
};

const ZOOM_RANGE = { min: 3, max: 21 };

const DASHBOARD_FOCUS_ZOOM = 8;

const NEAREST_FOCUS_ZOOM = 15;

const FOCUS_DURATION_MS = 500;

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

const COMPACT_POPOVER = "(max-width: 767px)";

export function LiveMap({
  hexagons,
  focusH3,
  selectedH3,
  focus = null,
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
  const [mapLoading, setMapLoading] = useState(true);

  const [popoverElement] = useState(() =>
    document.createElement("div"),
  );

  const isCompact = useMediaQuery(COMPACT_POPOVER);

  const [popoverPlacement, setPopoverPlacement] =
    useState<PopoverPlacement>("top-center");

  const hexagonsRef = useRef(hexagons);
  const selectedH3Ref = useRef(selectedH3);
  const boundsRef = useRef<LngLatBounds | null>(null);

  function updatePopoverPlacement(bounds: LngLatBounds) {
    const currentSelectedH3 = selectedH3Ref.current;

    if (!currentSelectedH3) {
      return;
    }

    const [lat, lng] = cellToLatLng(currentSelectedH3);

    setPopoverPlacement(getPopoverPlacement(bounds, lat, lng));
  }

  const maxEvents = hexagons.reduce(
    (max, hexagon) => Math.max(max, hexagon.events_count),
    1,
  );

  const selectedHexagon = selectedH3
    ? (hexagons.find(
      (hexagon) => hexagon.h3_index === selectedH3,
    ) ?? null)
    : null;

  useEffect(() => {
    if (selectedH3 && !selectedHexagon) {
      onSelectedH3Change(null);
    }
  }, [selectedH3, selectedHexagon, onSelectedH3Change]);

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
            zoomRange: ZOOM_RANGE,
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

            onUpdate: ({ location }) => {
              onViewportChange(
                toViewport(location.bounds, location.zoom),
              );

              boundsRef.current = location.bounds;
              updatePopoverPlacement(location.bounds);
            },
          }),
        );

        mapRef.current = map;

        onViewportChange(
          toViewport(map.bounds, map.zoom),
        );

        boundsRef.current = map.bounds;

        setMapVersion((version) => version + 1);
        setMapLoading(false);
      } catch {
        if (!disposed) {
          setMapError("Не удалось загрузить карту");
          setMapLoading(false);
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

  const pendingFocusRef = useRef<string | null>(null);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !focusH3) {
      return;
    }

    pendingFocusRef.current = focusH3;

    const [lat, lng] = cellToLatLng(focusH3);

    map.setLocation({
      center: [lng, lat] as LngLat,
      zoom: DASHBOARD_FOCUS_ZOOM,
      duration: 400,
    });
  }, [focusH3, mapVersion]);

  useEffect(() => {
    const pending = pendingFocusRef.current;

    if (!pending || hexagons.length === 0) {
      return;
    }

    const [lat, lng] = cellToLatLng(pending);

    const cell = latLngToCell(
      lat,
      lng,
      getResolution(hexagons[0].h3_index),
    );

    if (hexagons.some((hexagon) => hexagon.h3_index === cell)) {
      pendingFocusRef.current = null;
      onSelectedH3Change(cell);
    }
  }, [hexagons, onSelectedH3Change]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !focus) {
      return;
    }

    const [lat, lng] = cellToLatLng(focus.h3Index);

    map.setLocation({
      center: [lng, lat] as LngLat,
      zoom: NEAREST_FOCUS_ZOOM,
      duration: FOCUS_DURATION_MS,
    });
  }, [focus, mapVersion]);

  useEffect(() => {
    selectedH3Ref.current = selectedH3;

    if (selectedH3 && boundsRef.current) {
      updatePopoverPlacement(boundsRef.current);
    }
  }, [selectedH3]);

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

        {mapLoading && !mapError && (
          <p className={styles.liveMap__loading}>
            Загрузка…
          </p>
        )}

        {isCompact && selectedH3 && (
          <CellPopover
            hexagon={selectedHexagon}
            onClose={() => onSelectedH3Change(null)}
            placement="sheet"
          />
        )}
      </div>

      {!isCompact &&
        selectedH3 &&
        createPortal(
          <CellPopover
            hexagon={selectedHexagon}
            onClose={() => onSelectedH3Change(null)}
            placement={popoverPlacement}
          />,
          popoverElement,
        )}
    </>
  );
}
