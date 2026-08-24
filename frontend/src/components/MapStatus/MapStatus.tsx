import { useEffect, useRef } from "react";

import styles from "./MapStatus.module.scss";

type MapStatusProps = {
  loading: boolean;
  error: string | null;
  cellCount: number;
  onRetry: () => void;
};

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
        <strong>Загрузка…</strong>
      </div>
    );
  }

  if (showingRetry) {
    return (
      <div className={styles.mapStatus} ref={rootRef} tabIndex={-1}>
        <strong>Backend API</strong>

        <p className={styles.mapStatus__error} role="alert">
          {error}
        </p>

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
      <strong>Живая карта</strong>

      <span className={styles.mapStatus__count}>
        Ячеек: {cellCount}
      </span>

      {error && (
        <p className={styles.mapStatus__warning} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
