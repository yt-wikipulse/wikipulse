import { Link } from "react-router-dom";

import { useDocumentTitle } from "../hooks/useDocumentTitle";
import styles from "./NotFoundPage.module.scss";

export function NotFoundPage() {
  useDocumentTitle("WikiPulse — Страница не найдена");

  return (
    <main
      className={styles.notFoundPage}
      aria-labelledby="not-found-title"
    >
      <h1 id="not-found-title">Страница не найдена</h1>
      <p>Проверь адрес или вернись к живой карте.</p>
      <Link className={styles.notFoundPage__link} to="/map">
        Вернуться к карте
      </Link>
    </main>
  );
}
