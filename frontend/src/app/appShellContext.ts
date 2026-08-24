import { useOutletContext } from "react-router-dom";

export type AppShellContext = {
  headerSlotNode: HTMLElement | null;
};

export function useAppShellContext(): AppShellContext {
  return useOutletContext<AppShellContext>();
}
