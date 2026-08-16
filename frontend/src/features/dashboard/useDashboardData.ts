import { useCallback, useEffect, useState } from "react";

import { getDashboard, type DashboardResponse } from "../../api/dashboard";

// Витрины пересчитываются раз в час, поллинг дашборду не нужен:
// данные обновляются при смене периода и по кнопке повтора.
const TOP_LIMIT = 5;

type DashboardResult = {
  // Ключ запроса, ответ которого лежит в state. Пока он не совпадает
  // с текущим, показываем загрузку — отдельный флаг для этого не нужен.
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
          // Прошлый период на экране не оставляем: подписи говорили бы неправду.
          data: null,
          error:
            error instanceof Error
              ? error.message
              : "Не удалось загрузить дашборд",
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
