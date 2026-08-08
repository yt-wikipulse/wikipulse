import { useState } from "react";

import { LiveMap } from "./components/LiveMap/LiveMap";
import { hotspotSnapshots } from "./mocks/hotspots";
import styles from "./App.module.scss";

export default function App() {
  const [snapshotIndex, setSnapshotIndex] = useState<0 | 1>(0);
  const [selectedH3, setSelectedH3] = useState<string | null>(null);

  const hotspots = hotspotSnapshots[snapshotIndex];

  const selectedHotspot =
    hotspots.find((hotspot) => hotspot.h3 === selectedH3) ?? null;

  function toggleSnapshot() {
    setSnapshotIndex((current) => (current === 0 ? 1 : 0));
  }

  return (
    <main className={styles.page}>
      <section className={styles.mapPane}>
        <div className={styles.toolbar}>
          <div>
            <strong>Snapshot {snapshotIndex + 1}</strong>
            <span>{hotspots.length} ячейки</span>
          </div>
          <button
            className={styles.button}
            type="button"
            onClick={toggleSnapshot}
          >
            Заменить snapshot
          </button>
        </div>
        <LiveMap
          hotspots={hotspots}
          selectedH3={selectedH3}
          onSelectedH3Change={setSelectedH3}
        />
      </section>
      <aside className={styles.sidebar}>
        <h1>WikiPulse spike</h1>
        {!selectedH3 && (
          <p className={styles.secondary}>
            Нажми на синюю H3-ячейку.
          </p>
        )}
        {selectedH3 && !selectedHotspot && (
          <>
            <p className={styles.warning}>
              Выбранная ячейка отсутствует в текущем snapshot.
            </p>
            <code className={styles.h3}>{selectedH3}</code>
          </>
        )}
        {selectedHotspot && (
          <>
            <dl className={styles.details}>
              <div>
                <dt>H3</dt>
                <dd>
                  <code className={styles.h3}>
                    {selectedHotspot.h3}
                  </code>
                </dd>
              </div>
              <div>
                <dt>Resolution</dt>
                <dd>{selectedHotspot.resolution}</dd>
              </div>
              <div>
                <dt>Правок</dt>
                <dd>{selectedHotspot.edits_count}</dd>
              </div>
              <div>
                <dt>Редакторов</dt>
                <dd>{selectedHotspot.users_count}</dd>
              </div>
              <div>
                <dt>Последняя правка</dt>
                <dd>
                  {new Date(
                    selectedHotspot.last_event_at,
                  ).toLocaleString("ru-RU")}
                </dd>
              </div>
            </dl>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => setSelectedH3(null)}
            >
              Снять выбор
            </button>
          </>
        )}
      </aside>
    </main>
  );
}