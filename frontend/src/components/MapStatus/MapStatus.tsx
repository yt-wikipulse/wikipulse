import { useEffect, useRef } from "react";

import { LIVE_WINDOW_MINUTES } from "../../features/live-map/liveWindow";

import styles from "./MapStatus.module.scss";

type MapStatusProps = {
  loading: boolean;
  error: string | null;
  cellCount: number;
  onRetry: () => void;
};

function formatCells(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} ячейка`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} ячейки`;
  }

  return `${count} ячеек`;
}

export function MapStatus({
  loading,
  error,
  cellCount,
  onRetry,
}: MapStatusProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hadRetryButton = useRef(false);
  const isRetryFocused = useRef(false);

  const showingRetry = !loading && error !== null && cellCount === 0;

  useEffect(() => {
    if (hadRetryButton.current && !showingRetry && isRetryFocused.current) {
      rootRef.current?.focus();
      isRetryFocused.current = false;
    }

    hadRetryButton.current = showingRetry;
  });

  if (loading) {
    return (
      <div className={styles.mapStatus} ref={rootRef} tabIndex={-1}>
        <span className={styles.mapStatus__muted}>Загрузка…</span>
      </div>
    );
  }

  if (showingRetry) {
    return (
      <div
        className={styles.mapStatus}
        data-state="error"
        ref={rootRef}
        tabIndex={-1}
      >
        <span className={styles.mapStatus__error} role="alert">
          {error}
        </span>

        <button
          className={styles.mapStatus__retry}
          type="button"
          onClick={onRetry}
          onFocus={() => {
            isRetryFocused.current = true;
          }}
          onBlur={() => {
            isRetryFocused.current = false;
          }}
        >
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className={styles.mapStatus} ref={rootRef} tabIndex={-1}>
      <span className={styles.mapStatus__count}>
        {cellCount === 0 ? "Нет правок" : formatCells(cellCount)}
      </span>

      <span className={styles.mapStatus__separator} aria-hidden="true">
        •
      </span>

      <span className={styles.mapStatus__window}>
        за {LIVE_WINDOW_MINUTES} минут
      </span>

      {error !== null && (
        <span className={styles.mapStatus__warning} role="alert">
          <span aria-hidden="true">⚠</span>
          <span className={styles.mapStatus__srOnly}>{error}</span>
        </span>
      )}
    </div>
  );
}
