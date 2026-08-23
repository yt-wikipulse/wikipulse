import { useCallback, useEffect, useState } from "react";

import { fetchWikiDiff, type WikiDiff } from "../../api/wikiDiff";

type WikiDiffTarget = {
  title: string;
  url: string;
  diff_url: string;
};

type WikiDiffState = {
  diff: WikiDiff | null;
  loading: boolean;
  error: string | null;
};

const INITIAL_STATE: WikiDiffState = {
  diff: null,
  loading: true,
  error: null,
};

export function useWikiDiff(target: WikiDiffTarget) {
  const [state, setState] = useState<WikiDiffState>(INITIAL_STATE);
  const [attempt, setAttempt] = useState(0);

  const { title, url, diff_url } = target;

  useEffect(() => {
    const controller = new AbortController();

    fetchWikiDiff({ title, url, diff_url }, controller.signal)
      .then((diff) => {
        setState({ diff, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          diff: null,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Не удалось загрузить diff",
        });
      });

    return () => {
      controller.abort();
    };
  }, [title, url, diff_url, attempt]);

  const retry = useCallback(() => {
    setState(INITIAL_STATE);
    setAttempt((current) => current + 1);
  }, []);

  return { ...state, retry };
}
