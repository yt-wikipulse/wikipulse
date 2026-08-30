import { useCallback, useEffect, useState } from "react";

import { getDashboard, type DashboardResponse } from "../../api/dashboard";
import { describeError } from "../../lib/errorMessage";

const TOP_LIMIT = 5;

type DashboardResult = {
  /**
   * Ключ запроса, ответ которого сейчас лежит в состоянии. Пока он не совпал
   * с текущим, показывается загрузка — отдельный флаг для этого не нужен.
   */
  key: string;
  data: DashboardResponse | null;
  error: string | null;
};

const INITIAL_RESULT: DashboardResult = {
  key: "",
  data: null,
  error: null,
};

/**
 * Данные дашборда за период. Поллинга нет: витрины пересчитываются раз в час,
 * обновлять чаще нечего — данные перезапрашиваются при смене периода и по
 * кнопке повтора.
 *
 * При ошибке data сбрасывается в null: прошлый период на экране не остаётся,
 * иначе подписи под цифрами говорили бы неправду.
 */
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
