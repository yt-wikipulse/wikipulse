import { NavLink, useLocation } from "react-router-dom";

import styles from "./SegmentedTabs.module.scss";

export type SegmentedTabItem = {
  to: string;
  label: string;
};

type SegmentedTabsProps = {
  items: SegmentedTabItem[];
  ariaLabel: string;
};

export function SegmentedTabs({ items, ariaLabel }: SegmentedTabsProps) {
  const { pathname } = useLocation();

  const activeIndex = items.findIndex((item) => item.to === pathname);

  return (
    <nav className={styles.segmentedTabs} aria-label={ariaLabel}>
      {activeIndex >= 0 && (
        <span
          className={styles.segmentedTabs__indicator}
          style={{
            transform: `translateX(calc(var(--segmented-tab-width) * ${activeIndex}))`,
          }}
          aria-hidden="true"
        />
      )}

      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={styles.segmentedTabs__tab}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
