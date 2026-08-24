import { useEffect } from "react";

export const SITE_TITLE = "WikiPulse — живая карта правок Википедии";

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;

    return () => {
      document.title = SITE_TITLE;
    };
  }, [title]);
}
