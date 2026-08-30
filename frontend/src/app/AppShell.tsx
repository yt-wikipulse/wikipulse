import { AnimatePresence, motion } from "framer-motion";
import { Suspense, useMemo, useState } from "react";
import { useLocation, useOutlet } from "react-router-dom";

import { Header } from "../components/Header/Header";
import { Spinner } from "../components/Spinner/Spinner";
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

  const location = useLocation();
  const outlet = useOutlet(context);

  return (
    <div className={styles.appShell}>
      <Header slotRef={setHeaderSlotNode} showTabs={showTabs} />
      <div className={styles.appShell__content}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            className={styles.appShell__page}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Suspense
              fallback={
                <div className={styles.appShell__fallback}>
                  <Spinner label="Загрузка страницы" size="large" />
                </div>
              }
            >
              {outlet}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
