import {
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ActiveHexagon, HexagonEvent } from "../../api/hexagons";
import { DiffPopover } from "../DiffPopover/DiffPopover";
import styles from "./CellPopover.module.scss";

const TOP_ARTICLES_LIMIT = 3;

const DIFF_HOVER_DELAY_MS = 300;

export type PopoverPlacement =
  | "top-center"
  | "top-left"
  | "top-right"
  | "bottom-center"
  | "bottom-left"
  | "bottom-right"
  | "sheet";

type CellPopoverProps = {
  hexagon: ActiveHexagon | null;
  onClose: () => void;
  placement?: PopoverPlacement;
};

type ArticleSummary = {
  title: string;
  url: string;
  editsCount: number;
  latest: HexagonEvent;
};

function pluralizeEdits(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod100 >= 11 && mod100 <= 14) {
    return "правок";
  }

  if (mod10 === 1) {
    return "правка";
  }

  if (mod10 >= 2 && mod10 <= 4) {
    return "правки";
  }

  return "правок";
}

function summarizeTopArticles(
  events: HexagonEvent[],
  limit: number,
): ArticleSummary[] {
  const byTitle = new Map<string, ArticleSummary>();

  for (const event of events) {
    const existing = byTitle.get(event.title);

    if (existing) {
      existing.editsCount += 1;

      if (event.event_ts > existing.latest.event_ts) {
        existing.latest = event;
      }
    } else {
      byTitle.set(event.title, {
        title: event.title,
        url: event.url,
        editsCount: 1,
        latest: event,
      });
    }
  }

  return [...byTitle.values()]
    .sort((a, b) => b.editsCount - a.editsCount)
    .slice(0, limit);
}

export function CellPopover({
  hexagon,
  onClose,
  placement = "top-center",
}: CellPopoverProps) {
  const [diff, setDiff] = useState<{
    title: string;
    openedAt: number;
  } | null>(null);
  const hoverTimerRef = useRef<number | undefined>(undefined);

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

  useEffect(() => {
    return () => {
      window.clearTimeout(hoverTimerRef.current);
    };
  }, []);

  if (!hexagon) {
    return null;
  }

  function openDiff(title: string, delayMs: number) {
    window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(
      () => setDiff({ title, openedAt: Math.floor(Date.now() / 1000) }),
      delayMs,
    );
  }

  function handleArticleClick(
    articleEvent: MouseEvent<HTMLAnchorElement>,
    title: string,
  ) {
    if (diff?.title === title) {
      return;
    }

    articleEvent.preventDefault();
    openDiff(title, 0);
  }

  function handlePointer(
    pointerEvent: PointerEvent<HTMLElement>,
    action: () => void,
  ) {
    if (pointerEvent.pointerType === "mouse") {
      action();
    }
  }

  function closeDiff() {
    window.clearTimeout(hoverTimerRef.current);
    setDiff(null);
  }

  const topArticles = summarizeTopArticles(
    hexagon.events,
    TOP_ARTICLES_LIMIT,
  );

  return (
    <div
      className={styles.cellPopover}
      data-placement={placement}
      data-diff-open={diff !== null}
      role="dialog"
      aria-label="Активность ячейки"
    >
      <button
        className={styles.cellPopover__close}
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
      >
        ×
      </button>

      <div className={styles.cellPopover__stat}>
        <span className={styles.cellPopover__statLabel}>
          Правок за 30 минут
        </span>
        <span className={styles.cellPopover__statValue}>
          {hexagon.events_count}
        </span>
      </div>

      <h2 className={styles.cellPopover__sectionTitle}>Топ статей</h2>

      <ul className={styles.cellPopover__articles}>
        {topArticles.map((article) => (
          <li
            className={styles.cellPopover__articleItem}
            data-diff={diff?.title === article.title}
            key={article.title}
            onPointerEnter={(pointerEvent) =>
              handlePointer(pointerEvent, () =>
                openDiff(article.title, DIFF_HOVER_DELAY_MS),
              )
            }
            onPointerLeave={(pointerEvent) =>
              handlePointer(pointerEvent, closeDiff)
            }
          >
            <a
              className={styles.cellPopover__article}
              href={article.url}
              target="_blank"
              rel="noreferrer"
              data-active={diff?.title === article.title}
              onFocus={() => openDiff(article.title, 0)}
              onBlur={(blurEvent) => {
                if (blurEvent.relatedTarget) {
                  closeDiff();
                }
              }}
              onClick={(clickEvent) =>
                handleArticleClick(clickEvent, article.title)
              }
            >
              <span className={styles.cellPopover__articleTitle}>
                {article.title}
              </span>
              <span className={styles.cellPopover__articleMeta}>
                {article.editsCount} {pluralizeEdits(article.editsCount)}
              </span>
            </a>

            {diff?.title === article.title && (
              <div className={styles.cellPopover__diff}>
                <DiffPopover
                  event={article.latest}
                  openedAt={diff.openedAt}
                  onClose={closeDiff}
                  key={article.latest.id}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
