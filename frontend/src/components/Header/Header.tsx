import { NavLink } from "react-router-dom";

import styles from "./Header.module.scss";

const TABS = [
  { to: "/map", label: "Карта" },
  { to: "/dashboard", label: "Дашборд" },
];

export function Header() {
  return (
    <header className={styles.root}>
      <div className={styles.brand}>
        <span className={styles.dot} />
        <span className={styles.brandName}>WikiPulse</span>
      </div>
      <nav className={styles.nav}>
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={styles.tab}>
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
