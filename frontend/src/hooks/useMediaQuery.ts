import { useCallback, useSyncExternalStore } from "react";

// Часть адаптива нельзя выразить в CSS: сколько подписей влезает на ось и
// куда рендерить попап ячейки. Для таких мест — тот же брейкпоинт, но в JS.
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
    // На сервере медиазапросов нет — считаем экран широким.
    () => false,
  );
}
