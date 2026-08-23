import { describe, expect, it } from "vitest";

import { parseCompareBody, parseRevisions } from "./wikiDiff";

describe("parseRevisions", () => {
  it("достаёт ревизии из notify_url потока правок", () => {
    expect(
      parseRevisions(
        "https://ru.wikipedia.org/w/index.php?diff=154475554&oldid=154475304",
      ),
    ).toEqual({ fromRev: 154475304, toRev: 154475554 });
  });

  it("возвращает null, если ревизий в ссылке нет", () => {
    expect(
      parseRevisions("https://ru.wikipedia.org/wiki/Москва?diff=7"),
    ).toBeNull();
    expect(parseRevisions("не ссылка")).toBeNull();
  });
});

describe("parseCompareBody", () => {
  const body = `
    <tr><td colspan="2" class="diff-lineno">Строка 1:</td></tr>
    <tr>
      <td class="diff-marker" data-marker="−"></td>
      <td class="diff-deletedline diff-side-deleted"><div>Башня построена в <del class="diffchange diffchange-inline">1887</del> году</div></td>
      <td class="diff-marker" data-marker="+"></td>
      <td class="diff-addedline diff-side-added"><div>Башня построена в <ins class="diffchange diffchange-inline">1889</ins> году</div></td>
    </tr>
    <tr>
      <td colspan="2" class="diff-empty diff-side-deleted"></td>
      <td class="diff-marker" data-marker="+"></td>
      <td class="diff-addedline diff-side-added"><div>Новая строка</div></td>
    </tr>`;

  it("разворачивает две колонки в поток строк: сначала удалённая, потом добавленная", () => {
    const lines = parseCompareBody(body);

    expect(lines.map((line) => line.kind)).toEqual([
      "removed",
      "added",
      "added",
    ]);
  });

  it("помечает изменённый фрагмент внутри строки", () => {
    const [removed] = parseCompareBody(body);

    expect(removed.segments).toEqual([
      { text: "Башня построена в ", changed: false },
      { text: "1887", changed: true },
      { text: " году", changed: false },
    ]);
  });

  it("пропускает служебные строки без текста", () => {
    expect(parseCompareBody("<tr><td class='diff-lineno'>Строка 1:</td></tr>"))
      .toHaveLength(0);
  });

  it("не выполняет разметку из ответа", () => {
    const lines = parseCompareBody(
      `<tr><td class="diff-addedline"><div>&lt;img src=x onerror=alert(1)&gt;</div></td></tr>`,
    );

    expect(lines[0].segments[0].text).toBe("<img src=x onerror=alert(1)>");
  });
});
