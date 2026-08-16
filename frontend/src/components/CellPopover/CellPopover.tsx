import { useEffect } from "react";
import type { ActiveHexagon, HexagonEvent } from "../../api/hexagons";
import styles from "./CellPopover.module.scss";

const TOP_ARTICLES_LIMIT = 3;

type CellPopoverProps = {
  hexagon: ActiveHexagon | null;
  onClose: () => void;
};

type ArticleSummary = {
  title: string;
  url: string;
  editsCount: number;
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
    } else {
      byTitle.set(event.title, {
        title: event.title,
        url: event.url,
        editsCount: 1,
      });
    }
  }

  return [...byTitle.values()]
    .sort((a, b) => b.editsCount - a.editsCount)
    .slice(0, limit);
}

export function CellPopover({ hexagon, onClose }: CellPopoverProps) {
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

  if (!hexagon) {
    return null;
  }

  const topArticles = summarizeTopArticles(
    hexagon.events,
    TOP_ARTICLES_LIMIT,
  );

  return (
    <div
      className={styles.cellPopover}
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
          <li key={article.title}>
            <a
              className={styles.cellPopover__article}
              href={article.url}
              target="_blank"
              rel="noreferrer"
            >
              <span className={styles.cellPopover__articleTitle}>
                {article.title}
              </span>
              <span className={styles.cellPopover__articleMeta}>
                {article.editsCount} {pluralizeEdits(article.editsCount)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
