import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BehaviorType, LngLat, LngLatBounds } from "@yandex/ymaps3-types";
import { cellToLatLng, getResolution, latLngToCell } from "h3-js";

import type { ActiveHexagon } from "../../api/hexagons";
import { CellPopover, type PopoverPlacement } from "../CellPopover/CellPopover";
import {
  getFeatureStyle,
  getFillColor,
  getPopoverPlacement,
  h3ToPolygon,
  SELECTED_FILL_COLOR,
  toMultiPolygon,
  toViewport,
  type MapViewport,
} from "./LiveMap.helpers";
import { loadYmaps } from "./loadYmaps";
import { mapCustomization } from "./mapCustomization";

import { useMediaQuery } from "../../hooks/useMediaQuery";
import styles from "./LiveMap.module.scss";

export type { MapViewport };

export type MapFocus = {
  h3Index: string;
  // Зум, на котором эта ячейка была найдена: на нём бэкенд отдаёт ту же
  // резолюцию, поэтому центр камеры совпадает с центром нарисованного гексагона.
  zoom: number;
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

const FOCUS_DURATION_MS = 500;

const FADE_DURATION_MS = 220;

type LayerFeature = {
  feature: InstanceType<typeof ymaps3.YMapFeature>;
  fill: string;
  cells: string[];
};

function sameCells(current: string[], next: string[]) {
  return (
    current.length === next.length &&
    current.every((cell, index) => cell === next[index])
  );
}

function setLayerOpacity(
  layer: LayerFeature[],
  opacity: number,
) {
  for (const { feature, fill } of layer) {
    feature.update({
      style: getFeatureStyle(fill, opacity),
    });
  }
}

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

const HIGHLIGHT_Z_INDEX = 10;

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

  const featuresRef = useRef<LayerFeature[]>([]);

  const layerResolutionRef = useRef<number | null>(null);

  const fadeRef = useRef<(() => void) | null>(null);

  const [mapVersion, setMapVersion] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(true);

  const [popoverElement] = useState(() => {
    const element = document.createElement("div");

    element.className = styles.popoverAnchor;

    return element;
  });

  const isCompact = useMediaQuery(COMPACT_POPOVER);

  const [popoverPlacement, setPopoverPlacement] =
    useState<PopoverPlacement>("top-center");

  const hexagonsRef = useRef(hexagons);
  const pointerTargetRef = useRef<EventTarget | null>(null);
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
    function rememberTarget(domEvent: PointerEvent) {
      pointerTargetRef.current = domEvent.target;
    }

    window.addEventListener("pointerdown", rememberTarget, true);

    return () => {
      window.removeEventListener("pointerdown", rememberTarget, true);
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    async function createMap() {
      try {
        await loadYmaps();

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
            onFastClick: (_object, event) => {
              const target = pointerTargetRef.current;

              if (
                target instanceof Element &&
                target.closest('[data-map-popover="true"]')
              ) {
                return;
              }

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
      layerResolutionRef.current = null;
      fadeRef.current = null;
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

    fadeRef.current?.();

    const groups = new Map<string, string[]>();

    for (const hexagon of hexagons) {
      const fill = getFillColor(hexagon, maxEvents);

      const group = groups.get(fill);

      if (group) {
        group.push(hexagon.h3_index);
      } else {
        groups.set(fill, [hexagon.h3_index]);
      }
    }

    const previousLayer = featuresRef.current;
    const previousResolution = layerResolutionRef.current;

    const resolution =
      hexagons.length > 0
        ? getResolution(hexagons[0].h3_index)
        : null;

    const crossfade =
      previousLayer.length > 0 &&
      resolution !== null &&
      previousResolution !== null &&
      resolution !== previousResolution;

    const reusable = new Map<string, LayerFeature>();

    if (!crossfade) {
      for (const entry of previousLayer) {
        reusable.set(entry.fill, entry);
      }
    }

    const layer = [...groups].map(
      ([fill, cells]): LayerFeature => {
        const reused = reusable.get(fill);

        if (reused) {
          reusable.delete(fill);

          if (!sameCells(reused.cells, cells)) {
            reused.feature.update({
              geometry: toMultiPolygon(cells),
            });
          }

          return { feature: reused.feature, fill, cells };
        }

        const feature = new ymaps3.YMapFeature({
          geometry: toMultiPolygon(cells),
          style: getFeatureStyle(fill, crossfade ? 0 : 1),
        });

        map.addChild(feature);

        return { feature, fill, cells };
      },
    );

    featuresRef.current = layer;
    layerResolutionRef.current = resolution;

    const removePreviousLayer = () => {
      const stale = crossfade
        ? previousLayer
        : [...reusable.values()];

      for (const { feature } of stale) {
        map.removeChild(feature);
      }
    };

    if (!crossfade) {
      removePreviousLayer();
      return;
    }

    const startedAt = performance.now();
    let frameId = 0;

    const finishFade = () => {
      cancelAnimationFrame(frameId);
      fadeRef.current = null;

      removePreviousLayer();
      setLayerOpacity(layer, 1);
    };

    const step = (now: number) => {
      const progress = Math.min(
        (now - startedAt) / FADE_DURATION_MS,
        1,
      );

      if (progress === 1) {
        finishFade();
        return;
      }

      setLayerOpacity(previousLayer, 1 - progress);
      setLayerOpacity(layer, progress);

      frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);
    fadeRef.current = finishFade;

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [
    hexagons,
    maxEvents,
    mapVersion,
  ]);

  useEffect(() => {
    if (!selectedH3) {
      return;
    }

    const group = featuresRef.current.find(
      ({ cells }) => cells.includes(selectedH3),
    );

    if (!group) {
      return;
    }

    group.feature.update({
      geometry: toMultiPolygon(
        group.cells.filter((cell) => cell !== selectedH3),
      ),
    });

    return () => {
      if (featuresRef.current.includes(group)) {
        group.feature.update({
          geometry: toMultiPolygon(group.cells),
        });
      }
    };
  }, [selectedH3, hexagons, mapVersion]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !selectedH3) {
      return;
    }

    const highlight = new ymaps3.YMapFeature({
      geometry: {
        type: "Polygon",
        coordinates: [h3ToPolygon(selectedH3)],
      },

      style: {
        ...getFeatureStyle(SELECTED_FILL_COLOR, 1),
        zIndex: HIGHLIGHT_Z_INDEX,
      },
    });

    map.addChild(highlight);

    return () => {
      if (mapRef.current === map) {
        map.removeChild(highlight);
      }
    };
  }, [selectedH3, mapVersion]);

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
      zoom: focus.zoom,
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
        blockBehaviors: true,
        blockEvents: true,
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
        data-map-area="true"
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
      </div>

      {isCompact && selectedH3 && (
        <CellPopover
          hexagon={selectedHexagon}
          onClose={() => onSelectedH3Change(null)}
          placement="sheet"
        />
      )}

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
