import { NavLink } from "react-router-dom";

import styles from "./Header.module.scss";

const TABS = [
  { to: "/map", label: "Карта" },
  { to: "/dashboard", label: "Дашборд" },
];

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.header__brand}>
        <span className={styles.header__dot} />
        <span className={styles.header__brandName}>WikiPulse</span>
      </div>
      <nav className={styles.header__nav}>
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={styles.header__tab}>
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
