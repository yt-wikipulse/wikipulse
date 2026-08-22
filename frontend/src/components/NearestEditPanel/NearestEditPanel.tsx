import { useEffect } from "react";

import type { NearestEditState } from "../../features/nearest-edit/useNearestEdit";
import { formatDistance } from "../../features/nearest-edit/nearestEdit.helpers";

import styles from "./NearestEditPanel.module.scss";

type NearestEditPanelProps = {
  state: NearestEditState;
  onRetry: () => void;
  onShowOnMap: (h3Index: string) => void;
  onClose: () => void;
};

const SEARCH_STEPS_TOTAL = 3;

function PanelBody({
  state,
  onRetry,
  onShowOnMap,
}: {
  state: NearestEditState;
  onRetry: () => void;
  onShowOnMap: (h3Index: string) => void;
}) {
  switch (state.status) {
    case "idle":
      return null;

    case "requesting-geo":
      return (
        <p className={styles.nearestEditPanel__hint}>
          Определяем ваше местоположение…
        </p>
      );

    case "geo-denied":
      return (
        <>
          <p className={styles.nearestEditPanel__warning}>
            Доступ к геолокации запрещён.
          </p>
          <p className={styles.nearestEditPanel__hint}>
            Разрешите его в настройках сайта — иконка слева от адреса — и
            повторите.
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
        <>
          <p className={styles.nearestEditPanel__hint}>
            Ищем правки в радиусе {state.radiusKm} км…
          </p>
          <p className={styles.nearestEditPanel__meta}>
            Шаг {state.step} из {SEARCH_STEPS_TOTAL}
          </p>
        </>
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
            onClick={() => onShowOnMap(state.edit.h3Index)}
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
          ×
        </button>
      </div>

      <PanelBody
        state={state}
        onRetry={onRetry}
        onShowOnMap={onShowOnMap}
      />
    </aside>
  );
}
