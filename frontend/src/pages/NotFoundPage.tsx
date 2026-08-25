import { Link } from "react-router-dom";

import elephant from "../assets/404.svg";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import styles from "./NotFoundPage.module.scss";

export function NotFoundPage() {
  useDocumentTitle("WikiPulse — Страница не найдена");

  return (
    <main
      className={styles.notFoundPage}
      aria-labelledby="not-found-title"
    >
      <img
        className={styles.notFoundPage__illustration}
        src={elephant}
        alt=""
        aria-hidden="true"
      />
      <h1 id="not-found-title">Страница не найдена</h1>
      <Link className={styles.notFoundPage__link} to="/map">
        Вернуться к карте
      </Link>
    </main>
  );
}
