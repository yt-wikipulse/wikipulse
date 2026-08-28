import { useEffect, useRef } from "react";

import { LIVE_WINDOW_MINUTES } from "../../features/live-map/liveWindow";
import { plural } from "../../lib/format";
import { Spinner } from "../Spinner/Spinner";

import styles from "./MapStatus.module.scss";

type MapStatusProps = {
  loading: boolean;
  error: string | null;
  cellCount: number;
  onRetry: () => void;
};

const CELL_FORMS = {
  one: "ячейка",
  few: "ячейки",
  many: "ячеек",
};

function formatCells(count: number): string {
  return `${count} ${plural(count, CELL_FORMS)}`;
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
      <div
        className={styles.mapStatus}
        data-state="loading"
        ref={rootRef}
        tabIndex={-1}
      >
        <Spinner label="Загрузка" />
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
        /
      </span>

      <span className={styles.mapStatus__window}>
        {LIVE_WINDOW_MINUTES} минут
      </span>

      {error !== null && (
        <span className={styles.mapStatus__warning} role="alert">
          <svg
            className={styles.mapStatus__warningIcon}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6" />
            <path d="m9 9 6 6" />
          </svg>
          <span className={styles.mapStatus__srOnly}>{error}</span>
        </span>
      )}
    </div>
  );
}
