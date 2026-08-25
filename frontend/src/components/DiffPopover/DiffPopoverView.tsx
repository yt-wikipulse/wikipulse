import type { HexagonEvent } from "../../api/hexagons";
import type { WikiDiff } from "../../api/wikiDiff";
import {
  focusOnChange,
  formatEditAge,
  formatSizeDelta,
  pluralizeLines,
} from "./DiffPopover.helpers";

import styles from "./DiffPopover.module.scss";

export type DiffPopoverViewProps = {
  event: HexagonEvent;
  openedAt: number;
  diff: WikiDiff | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose?: () => void;
};

export function DiffPopoverView({
  event,
  openedAt,
  diff,
  loading,
  error,
  onRetry,
  onClose,
}: DiffPopoverViewProps) {
  const hiddenLines = diff ? diff.totalLines - diff.lines.length : 0;

  return (
    <aside
      className={styles.diffPopover}
      aria-label={`Diff правки статьи ${event.title}`}
    >
      <header className={styles.diffPopover__header}>
        <div className={styles.diffPopover__titleColumn}>
          <a
            className={styles.diffPopover__title}
            href={event.url}
            target="_blank"
            rel="noreferrer"
          >
            {event.title}
          </a>
          <span className={styles.diffPopover__meta}>
            {formatEditAge(event.event_ts, openedAt)}
          </span>
        </div>

        <span
          className={styles.diffPopover__delta}
          data-negative={event.length_update < 0}
        >
          {formatSizeDelta(event.length_update)}
        </span>

        {onClose ? (
          <button
            className={styles.diffPopover__close}
            type="button"
            aria-label="Закрыть diff"
            onClick={onClose}
          >
            <svg
              className={styles.diffPopover__closeIcon}
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
        ) : null}
      </header>

      {loading && (
        <div className={styles.diffPopover__skeleton} aria-hidden="true">
          <span />
          <span />
        </div>
      )}

      {error && (
        <div className={styles.diffPopover__error} role="alert">
          <span>{error}</span>
          <button type="button" onClick={onRetry}>
            Повторить
          </button>
        </div>
      )}

      {diff && diff.lines.length === 0 && (
        <p className={styles.diffPopover__empty}>
          Текст статьи не изменился — правка затронула только служебные данные.
        </p>
      )}

      {diff && diff.lines.length > 0 && (
        <div className={styles.diffPopover__lines}>
          {diff.lines.map((line, index) => (
            <p
              className={styles.diffPopover__line}
              data-kind={line.kind}
              key={index}
            >
              <span className={styles.diffPopover__sign} aria-hidden="true">
                {line.kind === "removed" ? "−" : "+"}
              </span>
              <span className={styles.diffPopover__text}>
                {focusOnChange(line.segments).map((segment, segmentIndex) =>
                  segment.changed ? (
                    <mark key={segmentIndex}>{segment.text}</mark>
                  ) : (
                    <span key={segmentIndex}>{segment.text}</span>
                  ),
                )}
              </span>
            </p>
          ))}
        </div>
      )}

      <footer className={styles.diffPopover__footer}>
        <a
          className={styles.diffPopover__link}
          href={event.diff_url || event.url}
          target="_blank"
          rel="noreferrer"
        >
          <span>
            {hiddenLines > 0
              ? `Ещё ${hiddenLines} ${pluralizeLines(hiddenLines)} — открыть на Wikipedia`
              : "Открыть на Wikipedia"}
          </span>
          <svg
            className={styles.diffPopover__linkIcon}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 3h6v6" />
            <path d="M10 14 21 3" />
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          </svg>
        </a>
      </footer>
    </aside>
  );
}
