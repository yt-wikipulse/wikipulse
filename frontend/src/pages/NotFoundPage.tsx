import { Link } from "react-router-dom";

import styles from "./NotFoundPage.module.scss";

export function NotFoundPage() {
  return (
    <main
      className={styles.root}
      aria-labelledby="not-found-title"
    >
      <h1 id="not-found-title">Страница не найдена</h1>
      <p>Проверь адрес или вернись к живой карте.</p>
      <Link className={styles.link} to="/map">
        Вернуться к карте
      </Link>
    </main>
  );
}