import { useEffect, useRef, useState } from "react";
import { cellToBoundary } from "h3-js";
import type { LngLat } from "@yandex/ymaps3-types";

import type { Hotspot } from "../../types/hotspot";

import styles from "./LiveMap.module.scss";

type LiveMapProps = {
  hotspots: Hotspot[];
  selectedH3: string | null;
  onSelectedH3Change: (h3: string) => void;
};

const INITIAL_LOCATION = {
  center: [37.6176, 55.7558] as LngLat,
  zoom: 7,
};

function h3ToPolygon(h3: string): LngLat[] {
  const boundary = cellToBoundary(h3).map(
    ([latitude, longitude]) => [longitude, latitude] as LngLat,
  );

  return boundary.length > 0 ? [...boundary, boundary[0]] : boundary;
}

function getFillColor(
  hotspot: Hotspot,
  maxEdits: number,
  selectedH3: string | null,
) {
  if (hotspot.h3 === selectedH3) {
    return "#ff5f1fe6";
  }

  const intensity = hotspot.edits_count / maxEdits;
  const alpha = Math.round(90 + intensity * 150)
    .toString(16)
    .padStart(2, "0");

  return `#0075ff${alpha}`;
}

export function LiveMap({
  hotspots,
  selectedH3,
  onSelectedH3Change,
}: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<InstanceType<typeof ymaps3.YMap> | null>(null);
  const featuresRef = useRef<
    InstanceType<typeof ymaps3.YMapFeature>[]
  >([]);
  const [mapVersion, setMapVersion] = useState(0);

  const maxEdits = Math.max(
    1,
    ...hotspots.map((hotspot) => hotspot.edits_count),
  );

  useEffect(() => {
    let disposed = false;

    void ymaps3.ready.then(() => {
      if (disposed || !containerRef.current) {
        return;
      }

      const map = new ymaps3.YMap(containerRef.current, {
        location: INITIAL_LOCATION,
      });

      map.addChild(new ymaps3.YMapDefaultSchemeLayer({}));
      map.addChild(new ymaps3.YMapDefaultFeaturesLayer({}));

      mapRef.current = map;
      setMapVersion((version) => version + 1);
    });

    return () => {
      disposed = true;
      featuresRef.current = [];
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    for (const feature of featuresRef.current) {
      map.removeChild(feature);
    }

    const features = hotspots.map((hotspot) => {
      const feature = new ymaps3.YMapFeature({
        id: hotspot.h3,
        geometry: {
          type: "Polygon",
          coordinates: [h3ToPolygon(hotspot.h3)],
        },
        style: {
          cursor: "pointer",
          fill: getFillColor(hotspot, maxEdits, selectedH3),
          stroke: [
            {
              color: "#ffffffd2",
              width: 1,
            },
          ],
        },
        onClick: () => {
          onSelectedH3Change(hotspot.h3);
        },
      });

      map.addChild(feature);

      return feature;
    });

    featuresRef.current = features;
  }, [
    hotspots,
    selectedH3,
    maxEdits,
    mapVersion,
    onSelectedH3Change,
  ]);

  return <div ref={containerRef} className={styles.root} />;
}