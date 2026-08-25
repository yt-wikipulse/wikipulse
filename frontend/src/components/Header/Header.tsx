import { NavLink } from "react-router-dom";

import ytLogo from "../../assets/yt-logo.svg";

import styles from "./Header.module.scss";

const TABS = [
  { to: "/map", label: "Карта" },
  { to: "/dashboard", label: "Дашборд" },
];

type HeaderProps = {
  slotRef?: (node: HTMLDivElement | null) => void;
};

export function Header({ slotRef }: HeaderProps) {
  return (
    <header className={styles.header}>
      <nav className={styles.header__nav}>
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={styles.header__tab}>
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className={styles.header__brand}>
        <span className={styles.header__brandName}>WikiPulse</span>
        <span className={styles.header__cross} aria-hidden="true">
          ×
        </span>
        <img className={styles.header__ytLogo} src={ytLogo} alt="YTsaurus" />
      </div>

      <div className={styles.header__slot} ref={slotRef} />
    </header>
  );
}
