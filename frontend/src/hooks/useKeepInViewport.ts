import { useLayoutEffect, useRef, useState } from "react";

export type ViewportSide = "right" | "left";

/**
 * Держит карточку в пределах экрана: выбирает сторону, с которой она
 * помещается, и сдвигает её вверх ровно на величину перекрытия нижнего края.
 *
 * ResizeObserver нужен потому, что карточка растёт по мере загрузки
 * содержимого: одного измерения при открытии недостаточно. В режиме листа
 * хук выключают — там карточка и так прижата к низу.
 */
export function useKeepInViewport<T extends HTMLElement>(
  enabled: boolean,
  margin = 16,
) {
  const ref = useRef<T>(null);
  const [side, setSide] = useState<ViewportSide>("right");

  useLayoutEffect(() => {
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

      const anchor = element.offsetParent;

      if (anchor) {
        const anchorRect = anchor.getBoundingClientRect();
        const width = element.offsetWidth;

        const fitsRight =
          anchorRect.right + width <= window.innerWidth - margin;

        const fitsLeft = anchorRect.left - width >= margin;

        setSide(fitsRight || !fitsLeft ? "right" : "left");
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

  return { ref, side };
}
