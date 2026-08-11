import {
  useCallback,
  useState,
} from "react";

import {
  LiveMap,
  type MapViewport,
} from "../components/LiveMap/LiveMap";
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
    error,
  } = useLiveMapData(viewport);

  const selectedHexagon =
    hexagons.find(
      (hexagon) =>
        hexagon.h3_index === selectedH3,
    ) ?? null;

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
        <div
          className={styles.liveMapPage__toolbar}
        >
          <div>
            <strong>
              {loading
                ? "Загрузка…"
                : "Backend API"}
            </strong>

            <span>
              {hexagons.length} ячеек
            </span>
          </div>

          {error && (
            <p
              className={
                styles.liveMapPage__warning
              }
              role="alert"
            >
              {error}
            </p>
          )}
        </div>

        <LiveMap
          hexagons={hexagons}
          selectedH3={selectedH3}
          onSelectedH3Change={setSelectedH3}
          onViewportChange={handleViewportChange}
        />
      </section>

      <aside
        className={styles.liveMapPage__sidebar}
      >
        <h1>WikiPulse</h1>

        {!selectedH3 && (
          <p
            className={
              styles.liveMapPage__secondary
            }
          >
            {loading
              ? "Загружаем активные ячейки…"
              : hexagons.length === 0
                ? "В этой области пока нет событий."
                : "Выберите ячейку на карте."}
          </p>
        )}

        {selectedH3 && !selectedHexagon && (
          <p
            className={
              styles.liveMapPage__warning
            }
          >
            Выбранная ячейка отсутствует
            в текущем ответе backend.
          </p>
        )}

        {selectedHexagon && (
          <>
            <dl
              className={
                styles.liveMapPage__details
              }
            >
              <div>
                <dt>H3</dt>
                <dd>
                  <code
                    className={
                      styles.liveMapPage__h3
                    }
                  >
                    {selectedHexagon.h3_index}
                  </code>
                </dd>
              </div>

              <div>
                <dt>Правок</dt>
                <dd>
                  {selectedHexagon.events_count}
                </dd>
              </div>
            </dl>

            <h2
              className={
                styles.liveMapPage__eventsTitle
              }
            >
              Изменённые статьи
            </h2>

            <ul
              className={
                styles.liveMapPage__events
              }
            >
              {selectedHexagon.events.map(
                (event) => (
                  <li key={event.id}>
                    <a
                      className={
                        styles.liveMapPage__link
                      }
                      href={event.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {event.title}
                    </a>
                  </li>
                ),
              )}
            </ul>

            <button
              className={`${styles.liveMapPage__button} ${
                styles[
                  "liveMapPage__button--secondary"
                ]
              }`}
              type="button"
              onClick={() => {
                setSelectedH3(null);
              }}
            >
              Снять выбор
            </button>
          </>
        )}
      </aside>
    </main>
  );
}