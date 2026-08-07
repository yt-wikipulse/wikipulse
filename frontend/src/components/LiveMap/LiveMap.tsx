import type { MapViewState } from "@deck.gl/core";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import DeckGL from "@deck.gl/react";
import type { Hotspot } from "../../types/hotspot";
import Map from "react-map-gl/maplibre";

import styles from "./LiveMap.module.scss";

type RgbaColor = [number, number, number, number];

type LiveMapProps = {
    hotspots: Hotspot[];
    selectedH3: string | null;
    onSelectedH3Change: (h3: string) => void;
};

const INITIAL_VIEW_STATE: MapViewState = {
    longitude: 37.6176,
    latitude: 55.7558,
    zoom: 7,
    pitch: 0,
    bearing: 0,
};

const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

  export function LiveMap({
  hotspots,
  selectedH3,
  onSelectedH3Change,
}: LiveMapProps) {
  const maxEdits = hotspots.reduce(
    (maximum, hotspot) => Math.max(maximum, hotspot.edits_count),
    1,
  );

  const layer = new H3HexagonLayer<Hotspot>({
    // ID должен оставаться одинаковым между render.
    // По нему deck.gl сопоставляет старый и новый слой.
    id: "live-hotspots-resolution-6",

    data: hotspots,

    // Как достать H3-индекс из объекта.
    getHexagon: (hotspot) => hotspot.h3,

    filled: true,
    stroked: true,
    pickable: true,
    autoHighlight: true,

    coverage: 0.88,

    getFillColor: (hotspot): RgbaColor => {
      if (hotspot.h3 === selectedH3) {
        return [255, 95, 31, 230];
      }

      const intensity = hotspot.edits_count / maxEdits;
      const alpha = Math.round(90 + intensity * 150);

      return [0, 117, 255, alpha];
    },

    getLineColor: [255, 255, 255, 210] as RgbaColor,
    lineWidthMinPixels: 1,

    highlightColor: [255, 255, 255, 100] as RgbaColor,

    onClick: ({ object }) => {
      if (!object) {
        return;
      }

      onSelectedH3Change(object.h3);
    },

    // Явно сообщаем, от чего зависит цвет.
    updateTriggers: {
      getFillColor: [selectedH3, maxEdits],
    },
  });

  return (
    <div className={styles.root}>
      <DeckGL
        controller
        initialViewState={INITIAL_VIEW_STATE}
        layers={[layer]}
      >
        <Map mapStyle={MAP_STYLE} />
      </DeckGL>
    </div>
  );
}