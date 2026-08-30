import { requestJson } from "./http";

export type WikiDiffFailure = "no-parent-revision" | "mediawiki-error";

export class WikiDiffError extends Error {
  reason: WikiDiffFailure;

  constructor(reason: WikiDiffFailure) {
    super(reason);

    this.name = "WikiDiffError";
    this.reason = reason;
  }
}

export type DiffSegment = {
  text: string;
  changed: boolean;
};

export type DiffLine = {
  kind: "removed" | "added";
  segments: DiffSegment[];
};

export type WikiDiff = {
  lines: DiffLine[];
  totalLines: number;
};

/** Больше строк в карточку не влезает, остальное уходит ссылкой в Википедию. */
export const DIFF_LINES_LIMIT = 8;

type Revisions = {
  fromRev: number;
  toRev: number;
};

/**
 * Достаёт пару ревизий из `notify_url` события. Его форма:
 * `https://ru.wikipedia.org/w/index.php?diff=154475554&oldid=154475304`.
 * Если ревизий в ссылке нет, возвращает null — тогда последняя пара
 * доспрашивается у `prop=revisions`.
 */
export function parseRevisions(diffUrl: string): Revisions | null {
  let params: URLSearchParams;

  try {
    params = new URL(diffUrl).searchParams;
  } catch {
    return null;
  }

  const toRev = Number(params.get("diff"));
  const fromRev = Number(params.get("oldid"));

  if (!Number.isInteger(toRev) || !Number.isInteger(fromRev)) {
    return null;
  }

  if (toRev <= 0 || fromRev <= 0) {
    return null;
  }

  return { fromRev, toRev };
}

/**
 * Адрес Action API того же языкового раздела, что и статья. `origin=*` —
 * анонимный CORS: без него Википедия не отдаст ответ в браузер.
 */
function apiUrl(articleUrl: string, params: Record<string, string>): string {
  const query = new URLSearchParams({
    format: "json",
    formatversion: "2",
    origin: "*",
    ...params,
  });

  return `${new URL(articleUrl).origin}/w/api.php?${query}`;
}

async function fetchLatestRevisions(
  articleUrl: string,
  title: string,
  signal?: AbortSignal,
): Promise<Revisions> {
  const payload = await requestJson<{
    query?: {
      pages?: { revisions?: { revid?: number; parentid?: number }[] }[];
    };
  }>(
    apiUrl(articleUrl, {
      action: "query",
      prop: "revisions",
      titles: title,
      rvprop: "ids",
      rvlimit: "1",
    }),
    signal,
  );

  const revision = payload.query?.pages?.[0]?.revisions?.[0];

  if (!revision?.revid || !revision.parentid) {
    throw new WikiDiffError("no-parent-revision");
  }

  return { fromRev: revision.parentid, toRev: revision.revid };
}

function readSegments(cell: Element): DiffSegment[] {
  const segments: DiffSegment[] = [];

  for (const node of cell.querySelector("div")?.childNodes ?? cell.childNodes) {
    const text = node.textContent ?? "";

    if (!text) {
      continue;
    }

    const changed =
      node.nodeType === 1 &&
      (node as Element).classList.contains("diffchange");

    const previous = segments.at(-1);

    if (previous && previous.changed === changed) {
      previous.text += text;
    } else {
      segments.push({ text, changed });
    }
  }

  return segments;
}

/**
 * Разбирает тело ответа `action=compare` в строки диффа.
 *
 * Ответ приходит набором строк таблицы без обёртки: маркер, удалённая строка,
 * добавленная. Двухколоночная таблица разворачивается в один поток —
 * сначала «−», потом «+».
 *
 * HTML разбирается DOMParser и рендерится текстом: в нём лежат правки
 * из Википедии, то есть пользовательский ввод, и innerHTML был бы дырой
 * на любой правке статьи.
 */
export function parseCompareBody(body: string): DiffLine[] {
  const document = new DOMParser().parseFromString(
    `<table><tbody>${body}</tbody></table>`,
    "text/html",
  );

  const lines: DiffLine[] = [];

  for (const row of document.querySelectorAll("tr")) {
    for (const cell of row.querySelectorAll(
      "td.diff-deletedline, td.diff-addedline",
    )) {
      const segments = readSegments(cell);

      if (segments.length === 0) {
        continue;
      }

      lines.push({
        kind: cell.classList.contains("diff-deletedline")
          ? "removed"
          : "added",
        segments,
      });
    }
  }

  return lines;
}

export async function fetchWikiDiff(
  event: { title: string; url: string; diff_url: string },
  signal?: AbortSignal,
): Promise<WikiDiff> {
  const revisions =
    parseRevisions(event.diff_url) ??
    (await fetchLatestRevisions(event.url, event.title, signal));

  const payload = await requestJson<{
    compare?: { body?: string };
    error?: { info?: string };
  }>(
    apiUrl(event.url, {
      action: "compare",
      fromrev: String(revisions.fromRev),
      torev: String(revisions.toRev),
      prop: "diff",
    }),
    signal,
  );

  if (payload.error) {
    throw new WikiDiffError("mediawiki-error");
  }

  const lines = parseCompareBody(payload.compare?.body ?? "");

  return {
    lines: lines.slice(0, DIFF_LINES_LIMIT),
    totalLines: lines.length,
  };
}
