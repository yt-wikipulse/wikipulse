import type { DiffSegment } from "../../api/wikiDiff";
import { formatNumber, plural } from "../../lib/format";

const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 60 * MINUTE_SECONDS;


export function formatEditAge(
  eventTs: number,
  nowSeconds: number,
): string {
  const age = nowSeconds - eventTs;

  if (age < MINUTE_SECONDS) {
    return "только что";
  }

  if (age < HOUR_SECONDS) {
    return `${Math.floor(age / MINUTE_SECONDS)} мин назад`;
  }

  return `${Math.floor(age / HOUR_SECONDS)} ч назад`;
}

export function formatSizeDelta(lengthUpdate: number): string {
  const sign = lengthUpdate < 0 ? "−" : "+";

  return `${sign}${formatNumber(Math.abs(lengthUpdate))} Б`;
}

const LINE_FORMS = {
  one: "строка",
  few: "строки",
  many: "строк",
};

export function pluralizeLines(count: number): string {
  return plural(count, LINE_FORMS);
}

const CONTEXT_BEFORE = 40;
const CONTEXT_AFTER = 80;

const ELLIPSIS = "…";

function cut(text: string, keep: number, side: "start" | "end"): DiffSegment[] {
  if (text.length <= keep) {
    return text ? [{ text, changed: false }] : [];
  }

  return [
    {
      text:
        side === "start"
          ? ELLIPSIS + text.slice(-keep)
          : text.slice(0, keep) + ELLIPSIS,
      changed: false,
    },
  ];
}

export function focusOnChange(
  segments: DiffSegment[],
  contextBefore = CONTEXT_BEFORE,
  contextAfter = CONTEXT_AFTER,
): DiffSegment[] {
  const first = segments.findIndex((segment) => segment.changed);

  if (first === -1) {
    const text = segments.map((segment) => segment.text).join("");
    return cut(text, contextBefore + contextAfter, "end");
  }

  let last = first;
  for (let i = segments.length - 1; i > first; i -= 1) {
    if (segments[i].changed) {
      last = i;
      break;
    }
  }

  const before = segments
    .slice(0, first)
    .map((segment) => segment.text)
    .join("");
  const after = segments
    .slice(last + 1)
    .map((segment) => segment.text)
    .join("");

  return [
    ...cut(before, contextBefore, "start"),
    ...segments.slice(first, last + 1),
    ...cut(after, contextAfter, "end"),
  ];
}
