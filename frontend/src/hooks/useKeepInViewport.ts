import { useEffect, useRef } from "react";

export function useKeepInViewport<T extends HTMLElement>(
  enabled: boolean,
  margin = 16,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    if (!enabled) {
      element.style.transform = "";
      return;
    }

    function fit() {
      if (!element) {
        return;
      }

      element.style.transform = "";

      const rect = element.getBoundingClientRect();
      const overflow = rect.bottom - (window.innerHeight - margin);

      if (overflow <= 0) {
        return;
      }

      const shift = Math.min(overflow, Math.max(0, rect.top - margin));

      element.style.transform = `translateY(${-shift}px)`;
    }

    fit();

    window.addEventListener("resize", fit);

    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);

    observer?.observe(element);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [enabled, margin]);

  return ref;
}
