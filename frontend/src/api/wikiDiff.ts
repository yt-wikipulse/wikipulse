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

export const DIFF_LINES_LIMIT = 8;

type Revisions = {
  fromRev: number;
  toRev: number;
};

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

function apiUrl(articleUrl: string, params: Record<string, string>): string {
  const query = new URLSearchParams({
    format: "json",
    formatversion: "2",
    origin: "*",
    ...params,
  });

  return `${new URL(articleUrl).origin}/w/api.php?${query}`;
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`MediaWiki ответил ${response.status}`);
  }

  return response.json();
}

async function fetchLatestRevisions(
  articleUrl: string,
  title: string,
  signal?: AbortSignal,
): Promise<Revisions> {
  const payload = (await fetchJson(
    apiUrl(articleUrl, {
      action: "query",
      prop: "revisions",
      titles: title,
      rvprop: "ids",
      rvlimit: "1",
    }),
    signal,
  )) as {
    query?: {
      pages?: { revisions?: { revid?: number; parentid?: number }[] }[];
    };
  };

  const revision = payload.query?.pages?.[0]?.revisions?.[0];

  if (!revision?.revid || !revision.parentid) {
    throw new Error("У статьи нет предыдущей ревизии");
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

  const payload = (await fetchJson(
    apiUrl(event.url, {
      action: "compare",
      fromrev: String(revisions.fromRev),
      torev: String(revisions.toRev),
      prop: "diff",
    }),
    signal,
  )) as { compare?: { body?: string }; error?: { info?: string } };

  if (payload.error) {
    throw new Error(payload.error.info ?? "MediaWiki вернул ошибку");
  }

  const lines = parseCompareBody(payload.compare?.body ?? "");

  return {
    lines: lines.slice(0, DIFF_LINES_LIMIT),
    totalLines: lines.length,
  };
}
