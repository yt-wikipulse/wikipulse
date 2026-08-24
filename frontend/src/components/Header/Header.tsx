import { NavLink } from "react-router-dom";

import ytLogo from "../../assets/yt-logo.svg";

import styles from "./Header.module.scss";

const TABS = [
  { to: "/map", label: "Карта" },
  { to: "/dashboard", label: "Дашборд" },
];

type HeaderProps = {
  showNearestEdit?: boolean;
  isNearestEditOpen?: boolean;
  onNearestEditClick?: () => void;
};

export function Header({
  showNearestEdit = false,
  isNearestEditOpen = false,
  onNearestEditClick,
}: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.header__brand}>
        <span className={styles.header__brandName}>WikiPulse</span>
        <span className={styles.header__cross} aria-hidden="true">
          ×
        </span>
        <img className={styles.header__ytLogo} src={ytLogo} alt="YTsaurus" />
      </div>
      <nav className={styles.header__nav}>
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={styles.header__tab}>
            {tab.label}
          </NavLink>
        ))}
      </nav>
      {showNearestEdit && (
        <button
          className={styles.header__nearestEdit}
          type="button"
          aria-pressed={isNearestEditOpen}
          onClick={onNearestEditClick}
        >
          Ближайшая правка
        </button>
      )}
    </header>
  );
}
