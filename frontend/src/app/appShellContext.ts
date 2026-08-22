import { useOutletContext } from "react-router-dom";

export type AppShellContext = {
  isNearestEditOpen: boolean;
  closeNearestEdit: () => void;
};

export function useAppShellContext(): AppShellContext {
  return useOutletContext<AppShellContext>();
}
