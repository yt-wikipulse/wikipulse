import { useEffect } from "react";

import type { NearestEditState } from "../../features/nearest-edit/useNearestEdit";
import { formatDistance } from "../../features/nearest-edit/nearestEdit.helpers";
import { Spinner } from "../Spinner/Spinner";

import styles from "./NearestEditPanel.module.scss";

type NearestEditPanelProps = {
  state: NearestEditState;
  onRetry: () => void;
  onShowOnMap: (h3Index: string, zoom: number) => void;
  onClose: () => void;
};

function PanelBody({
  state,
  onRetry,
  onShowOnMap,
}: {
  state: NearestEditState;
  onRetry: () => void;
  onShowOnMap: (h3Index: string, zoom: number) => void;
}) {
  switch (state.status) {
    case "idle":
      return null;

    case "requesting-geo":
      return (
        <div className={styles.nearestEditPanel__spinnerRow}>
          <Spinner label="Определяем ваше местоположение" />
        </div>
      );

    case "geo-denied":
      return (
        <>
          <p className={styles.nearestEditPanel__warning}>
            Доступ к геолокации запрещён.
          </p>
          <p className={styles.nearestEditPanel__hint}>
            Разрешите его в настройках сайта и повторите попытку.
          </p>
        </>
      );

    case "geo-unavailable":
      return (
        <>
          <p className={styles.nearestEditPanel__warning}>
            {state.reason === "unsupported"
              ? "Браузер не умеет определять местоположение."
              : state.reason === "insecure-context"
                ? "Геолокация доступна только по HTTPS или на localhost."
                : state.reason === "timeout"
                  ? "Не дождались ответа от геолокации."
                  : "Не удалось определить местоположение."}
          </p>
          {(state.reason === "timeout" ||
            state.reason === "position-failed") && (
            <button
              className={styles.nearestEditPanel__retry}
              type="button"
              onClick={onRetry}
            >
              Повторить
            </button>
          )}
        </>
      );

    case "searching":
      return (
        <div className={styles.nearestEditPanel__spinnerRow}>
          <Spinner label="Ищем ближайшую правку" />
        </div>
      );

    case "found":
      return (
        <>
          <div className={styles.nearestEditPanel__stat}>
            <span className={styles.nearestEditPanel__statValue}>
              ≈ {formatDistance(state.edit.distanceKm)}
            </span>
            <span className={styles.nearestEditPanel__statLabel}>от вас</span>
          </div>

          <a
            className={styles.nearestEditPanel__article}
            href={state.edit.url}
            target="_blank"
            rel="noreferrer"
          >
            {state.edit.title}
          </a>

          <button
            className={styles.nearestEditPanel__showOnMap}
            type="button"
            onClick={() => onShowOnMap(state.edit.h3Index, state.zoom)}
          >
            Показать на карте
          </button>
        </>
      );

    case "empty":
      return (
        <>
          <p className={styles.nearestEditPanel__hint}>
            За последние 30 минут рядом ничего не правили.
          </p>
          <button
            className={styles.nearestEditPanel__retry}
            type="button"
            onClick={onRetry}
          >
            Повторить
          </button>
        </>
      );

    case "request-failed":
      return (
        <>
          <p className={styles.nearestEditPanel__warning}>{state.message}</p>
          <button
            className={styles.nearestEditPanel__retry}
            type="button"
            onClick={onRetry}
          >
            Повторить
          </button>
        </>
      );
  }
}

export function NearestEditPanel({
  state,
  onRetry,
  onShowOnMap,
  onClose,
}: NearestEditPanelProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (state.status === "idle") {
    return null;
  }

  return (
    <aside
      className={styles.nearestEditPanel}
      role="dialog"
      aria-label="Ближайшая правка"
    >
      <div className={styles.nearestEditPanel__head}>
        <h2 className={styles.nearestEditPanel__title}>Ближайшая правка</h2>
        <button
          className={styles.nearestEditPanel__close}
          type="button"
          aria-label="Закрыть"
          onClick={onClose}
        >
          <svg
            className={styles.nearestEditPanel__closeIcon}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <PanelBody state={state} onRetry={onRetry} onShowOnMap={onShowOnMap} />
    </aside>
  );
}
