import {
  useCallback,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
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
import { SITE_TITLE, useDocumentTitle } from "../hooks/useDocumentTitle";
import { COMPACT_LAYOUT, useMediaQuery } from "../hooks/useMediaQuery";

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
  useDocumentTitle(SITE_TITLE);

  const [viewport, setViewport] =
    useState<MapViewport | null>(null);

  const [selectedH3, setSelectedH3] =
    useState<string | null>(null);

  const [mapError, setMapError] =
    useState<string | null>(null);

  const mapFailed = mapError !== null;

  /**
   * Ячейка из `?h3=` — так работает переход из блока «Топ мест» на дашборде.
   */
  const [searchParams] = useSearchParams();
  const focusH3 = searchParams.get("h3");

  const {
    hexagons,
    loading,
    error,
    retry,
  } = useLiveMapData(viewport);

  const { headerSlotNode } = useAppShellContext();

  const isCompactHeader = useMediaQuery(COMPACT_LAYOUT);

  /**
   * Состояние «Ближайшей правки» живёт на странице, а не в каркасе: кнопка
   * и панель принадлежат карте, поэтому уход с маршрута закрывает их сам собой
   * размонтированием.
   */
  const [isNearestEditOpen, setIsNearestEditOpen] =
    useState(false);

  const closeNearestEdit = useCallback(() => {
    setIsNearestEditOpen(false);
  }, []);

  const toggleNearestEdit = useCallback(() => {
    setIsNearestEditOpen((current) => !current);
  }, []);

  const {
    state: nearestEditState,
    retry: retryNearestEdit,
  } = useNearestEdit(isNearestEditOpen && !mapFailed);

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

  /**
   * Одна и та же разметка кнопки на оба случая, меняется только место в DOM.
   * На широком экране кнопка уезжает порталом в слот хедера, ниже брейкпоинта
   * рендерится на карте в той же правой колонке, что и её панель: в 57 пикселей
   * хедера три группы на узком экране не помещаются.
   *
   * На узком экране подпись не удаляется, а прячется визуально — доступное имя
   * кнопки должно остаться прежним.
   */
  const nearestEditButton = (
    <button
      className={styles.liveMapPage__nearestEdit}
      type="button"
      aria-pressed={isNearestEditOpen}
      onClick={toggleNearestEdit}
    >
      <svg
        className={styles.liveMapPage__nearestEditIcon}
        viewBox="0 0 16 16"
        aria-hidden="true"
      >
        <circle
          cx="8"
          cy="8"
          r="5.25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M8 .75v2.5M8 12.75v2.5M.75 8h2.5M12.75 8h2.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      </svg>

      <span className={styles.liveMapPage__nearestEditLabel}>
        Ближайшая правка
      </span>
    </button>
  );

  return (
    <main className={styles.liveMapPage}>
      <h1 className={styles.liveMapPage__srOnly}>
        Живая карта правок Википедии
      </h1>

      {!mapFailed &&
        !isCompactHeader &&
        headerSlotNode !== null &&
        createPortal(nearestEditButton, headerSlotNode)}

      <section
        className={styles.liveMapPage__map}
      >
        {!mapFailed && (
          <MapStatus
            loading={loading}
            error={error}
            cellCount={hexagons.length}
            onRetry={retry}
          />
        )}

        <LiveMap
          hexagons={hexagons}
          focusH3={focusH3}
          selectedH3={selectedH3}
          focus={mapFocus}
          onSelectedH3Change={setSelectedH3}
          onViewportChange={handleViewportChange}
          onMapErrorChange={setMapError}
        />

        {!mapFailed && (
          <div className={styles.liveMapPage__controls}>
            {isCompactHeader && nearestEditButton}

            <NearestEditPanel
              state={nearestEditState}
              onRetry={retryNearestEdit}
              onShowOnMap={handleShowOnMap}
              onClose={closeNearestEdit}
            />
          </div>
        )}
      </section>
    </main>
  );
}
