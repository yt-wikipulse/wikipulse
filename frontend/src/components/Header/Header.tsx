import { Link } from "react-router-dom";

import ytLogo from "../../assets/yt-logo.svg";
import {
  SegmentedTabs,
  type SegmentedTabItem,
} from "../SegmentedTabs/SegmentedTabs";

import styles from "./Header.module.scss";

const TABS: SegmentedTabItem[] = [
  { to: "/map", label: "Карта" },
  { to: "/dashboard", label: "Дашборд" },
];

type HeaderProps = {
  slotRef?: (node: HTMLDivElement | null) => void;
  showTabs?: boolean;
};

export function Header({ slotRef, showTabs = true }: HeaderProps) {
  return (
    <header
      className={`${styles.header} ${
        showTabs ? "" : styles["header--withoutTabs"]
      }`}
    >
      <div className={styles.header__nav}>
        {showTabs ? <SegmentedTabs items={TABS} ariaLabel="Разделы" /> : null}
      </div>

      <div className={styles.header__brand}>
        <Link className={styles.header__brandName} to="/map">
          WikiPulse
        </Link>
        <svg
          className={styles.header__cross}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
        <a
          className={styles.header__ytLink}
          href="https://ytsaurus.tech/ru"
          target="_blank"
          rel="noreferrer"
        >
          <img className={styles.header__ytLogo} src={ytLogo} alt="YTsaurus" />
        </a>
      </div>

      <div className={styles.header__slot} ref={slotRef} />
    </header>
  );
}
