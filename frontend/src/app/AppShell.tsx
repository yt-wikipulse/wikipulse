import { useMemo, useState } from "react";
import { Outlet } from "react-router-dom";

import { Header } from "../components/Header/Header";
import type { AppShellContext } from "./appShellContext";
import styles from "./AppShell.module.scss";

export function AppShell() {
  const [headerSlotNode, setHeaderSlotNode] =
    useState<HTMLElement | null>(null);

  const context = useMemo<AppShellContext>(
    () => ({ headerSlotNode }),
    [headerSlotNode],
  );

  return (
    <div className={styles.appShell}>
      <Header slotRef={setHeaderSlotNode} />
      <div className={styles.appShell__content}>
        <Outlet context={context} />
      </div>
    </div>
  );
}
