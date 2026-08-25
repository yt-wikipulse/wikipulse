import { useMemo, useState } from "react";
import { Outlet } from "react-router-dom";

import { Header } from "../components/Header/Header";
import type { AppShellContext } from "./appShellContext";
import styles from "./AppShell.module.scss";

type AppShellProps = {
  showTabs?: boolean;
};

export function AppShell({ showTabs = true }: AppShellProps) {
  const [headerSlotNode, setHeaderSlotNode] =
    useState<HTMLElement | null>(null);

  const context = useMemo<AppShellContext>(
    () => ({ headerSlotNode }),
    [headerSlotNode],
  );

  return (
    <div className={styles.appShell}>
      <Header slotRef={setHeaderSlotNode} showTabs={showTabs} />
      <div className={styles.appShell__content}>
        <Outlet context={context} />
      </div>
    </div>
  );
}
