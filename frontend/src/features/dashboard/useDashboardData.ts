import { useCallback, useEffect, useState } from "react";

import { getDashboard, type DashboardResponse } from "../../api/dashboard";
import { describeError } from "../../lib/errorMessage";

const TOP_LIMIT = 5;

type DashboardResult = {
  key: string;
  data: DashboardResponse | null;
  error: string | null;
};

const INITIAL_RESULT: DashboardResult = {
  key: "",
  data: null,
  error: null,
};

export function useDashboardData(period: string) {
  const [result, setResult] = useState<DashboardResult>(INITIAL_RESULT);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  const key = `${period}#${attempt}`;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    getDashboard({ period, limit: TOP_LIMIT }, controller.signal)
      .then((data) => {
        if (!cancelled) {
          setResult({ key, data, error: null });
        }
      })
      .catch((error: unknown) => {
        if (cancelled || controller.signal.aborted) {
          return;
        }

        setResult({
          key,
          data: null,
          error: describeError(error, "Не удалось загрузить дашборд"),
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [period, key]);

  const loading = result.key !== key;

  return {
    data: loading ? null : result.data,
    error: loading ? null : result.error,
    loading,
    reload,
  };
}
