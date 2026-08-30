import {
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ActiveHexagon, HexagonEvent } from "../../api/hexagons";
import { LIVE_WINDOW_MINUTES } from "../../features/live-map/liveWindow";
import { pluralizeEdits } from "../../lib/format";
import { useKeepInViewport } from "../../hooks/useKeepInViewport";
import { DiffPopover } from "../DiffPopover/DiffPopover";
import styles from "./CellPopover.module.scss";

const TOP_ARTICLES_LIMIT = 3;

/**
 * Задержка перед запросом диффа по наведению: курсор проезжает по списку
 * насквозь, и без неё это очередь запросов в MediaWiki на каждую строку
 * под указателем.
 */
const DIFF_HOVER_DELAY_MS = 300;

/**
 * Задержка закрытия по уходу курсора; отменяется, когда курсор дошёл до самой
 * карточки. Пока дифф грузится, карточка меняет высоту и может уехать из-под
 * курсора: без задержки она закрывалась бы ровно в тот момент, когда
 * пользователь тянется к ней мышью.
 */
const DIFF_CLOSE_DELAY_MS = 160;

const POPOVER_GAP = 14;

const POPOVER_MARGIN = 16;

const POPOVER_SETTLE_MS = 200;

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

  /**
   * Самая свежая правка статьи по `event_ts` — по ней показывается дифф.
   * Порядок событий внутри ячейки не гарантирован, поэтому выбор по времени,
   * а не по позиции в списке.
   */
  latest: HexagonEvent;
};

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

/**
 * Карточка ячейки: статистика и топ статей, у каждой — дифф последней правки.
 *
 * Клик закрепляет карточку диффа, наведение — нет: открытая наведением
 * закрывается вслед за курсором, открытая кликом живёт до крестика. Эти два
 * случая различает флаг `pinned`.
 *
 * В режиме `sheet` (узкий экран) карточка шире карты, поэтому поповер
 * прижимается к нижнему краю, а дифф заменяет его содержимое: лист и дифф
 * занимают одно и то же место и иначе наложились бы друг на друга.
 */
export function CellPopover({
  hexagon,
  onClose,
  placement = "top-center",
}: CellPopoverProps) {
  const [diff, setDiff] = useState<{
    title: string;
    openedAt: number;
    pinned: boolean;
  } | null>(null);
  const hoverTimerRef = useRef<number | undefined>(undefined);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const { ref: diffRef, side: diffSide } =
    useKeepInViewport<HTMLDivElement>(
      diff !== null && placement !== "sheet",
    );

  const rootRef = useRef<HTMLElement>(null);

  const [flipped, setFlipped] =
    useState<PopoverPlacement | null>(null);

  const [measured, setMeasured] = useState(false);

  const [settled, setSettled] = useState(false);

  const ready = measured || placement === "sheet";

  useEffect(() => {
    const timerId = window.setTimeout(
      () => setMeasured(true),
      POPOVER_SETTLE_MS,
    );

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const frameId = requestAnimationFrame(() =>
      setSettled(true),
    );

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [ready]);

  useLayoutEffect(() => {
    const element = rootRef.current;

    if (!element || placement === "sheet") {
      return;
    }

    function fit() {
      const anchor = element?.offsetParent;
      const area = element?.closest("[data-map-area]");

      if (!element || !anchor || !area) {
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const areaRect = area.getBoundingClientRect();
      const height = element.offsetHeight;

      const [vertical, horizontal] = placement.split("-");

      setMeasured(true);

      const fitsAbove =
        anchorRect.top - POPOVER_GAP - height >=
        areaRect.top + POPOVER_MARGIN;

      const fitsBelow =
        anchorRect.bottom + POPOVER_GAP + height <=
        areaRect.bottom - POPOVER_MARGIN;

      if (vertical === "top" && !fitsAbove && fitsBelow) {
        setFlipped(`bottom-${horizontal}` as PopoverPlacement);
        return;
      }

      if (vertical === "bottom" && !fitsBelow && fitsAbove) {
        setFlipped(`top-${horizontal}` as PopoverPlacement);
        return;
      }

      setFlipped(null);
    }

    fit();

    window.addEventListener("resize", fit);

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(fit);

    observer?.observe(element);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [placement, hexagon]);

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
      window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  if (!hexagon) {
    return null;
  }

  function openDiff(title: string, delayMs: number, pinned = false) {
    window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(
      () =>
        setDiff({ title, openedAt: Math.floor(Date.now() / 1000), pinned }),
      delayMs,
    );
  }

  /**
   * На тач-устройствах наведения нет, поэтому первый тап по строке открывает
   * дифф вместо перехода. Ссылка на статью живёт внутри карточки, повторный
   * тап уводит на неё как обычная ссылка.
   */
  function handleArticleClick(
    articleEvent: MouseEvent<HTMLAnchorElement>,
    title: string,
  ) {
    if (diff?.title === title) {
      return;
    }

    articleEvent.preventDefault();
    openDiff(title, 0, true);
  }

  /**
   * Наведение слушается через pointer-события с фильтром по `pointerType`,
   * а не через `mouseenter`/`mouseleave`: после тапа браузер досылает мышиные
   * события совместимости, и карточка закрывалась бы сразу после открытия.
   */
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
    window.clearTimeout(closeTimerRef.current);
    setDiff(null);
  }

  function cancelScheduledClose() {
    window.clearTimeout(closeTimerRef.current);
  }

  function scheduleCloseUnpinned() {
    window.clearTimeout(hoverTimerRef.current);
    window.clearTimeout(closeTimerRef.current);

    closeTimerRef.current = window.setTimeout(
      () => setDiff((current) => (current?.pinned ? current : null)),
      DIFF_CLOSE_DELAY_MS,
    );
  }

  const topArticles = summarizeTopArticles(
    hexagon.events,
    TOP_ARTICLES_LIMIT,
  );

  return (
    <aside
      className={styles.cellPopover}
      ref={rootRef}
      data-map-popover="true"
      data-placement={flipped ?? placement}
      data-ready={ready}
      data-settled={settled}
      data-diff-open={diff !== null}
      aria-label="Активность ячейки"
    >
      <button
        className={styles.cellPopover__close}
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
      >
        <svg
          className={styles.cellPopover__closeIcon}
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

      <div className={styles.cellPopover__stat}>
        <span className={styles.cellPopover__statLabel}>
          Правок за {LIVE_WINDOW_MINUTES} минут
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
              handlePointer(pointerEvent, () => {
                cancelScheduledClose();
                openDiff(article.title, DIFF_HOVER_DELAY_MS);
              })
            }
            onPointerLeave={(pointerEvent) =>
              handlePointer(pointerEvent, scheduleCloseUnpinned)
            }
          >
            <a
              className={styles.cellPopover__article}
              href={article.url}
              target="_blank"
              rel="noreferrer"
              onFocus={() => openDiff(article.title, 0)}
              onBlur={(blurEvent) => {
                if (blurEvent.relatedTarget) {
                  scheduleCloseUnpinned();
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
              <div
                className={styles.cellPopover__diff}
                data-side={diffSide}
                ref={diffRef}
                onPointerEnter={cancelScheduledClose}
                onPointerLeave={(pointerEvent) =>
                  handlePointer(pointerEvent, scheduleCloseUnpinned)
                }
              >
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
    </aside>
  );
}
