import type { HexagonEvent } from "../../api/hexagons";
import { useWikiDiff } from "../../features/wiki-diff/useWikiDiff";
import {
  formatEditAge,
  formatSizeDelta,
  pluralizeLines,
} from "./DiffPopover.helpers";

import styles from "./DiffPopover.module.scss";

type DiffPopoverProps = {
  event: HexagonEvent;
  /** Момент открытия карточки: «сколько назад» считаем от него, а не в рендере. */
  openedAt: number;
};

export function DiffPopover({ event, openedAt }: DiffPopoverProps) {
  const { diff, loading, error, retry } = useWikiDiff(event);

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
          <button type="button" onClick={retry}>
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
                {line.segments.map((segment, segmentIndex) =>
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
          {hiddenLines > 0
            ? `Ещё ${hiddenLines} ${pluralizeLines(hiddenLines)} — открыть на Wikipedia ↗`
            : "Открыть на Wikipedia ↗"}
        </a>
      </footer>
    </aside>
  );
}
