import { useCallback, useSyncExternalStore } from "react";

export const COMPACT_LAYOUT = "(max-width: 767px)";

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
