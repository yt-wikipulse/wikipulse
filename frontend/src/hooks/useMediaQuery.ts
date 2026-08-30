import { useCallback, useSyncExternalStore } from "react";

export const COMPACT_LAYOUT = "(max-width: 767px)";

/**
 * Брейкпоинт в JavaScript — для того адаптива, который нельзя выразить в CSS:
 * сколько подписей влезает на ось графика и куда рендерить поповер ячейки.
 *
 * Серверный снимок возвращает false: медиазапросов вне браузера нет,
 * считаем экран широким.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);

      list.addEventListener("change", onChange);

      return () => {
        list.removeEventListener("change", onChange);
      };
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
