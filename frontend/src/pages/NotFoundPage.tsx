import { Link } from "react-router-dom";

import { ErrorScreen } from "../components/ErrorScreen/ErrorScreen";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import styles from "./NotFoundPage.module.scss";

export function NotFoundPage() {
  useDocumentTitle("WikiPulse — Страница не найдена");

  return (
    <main
      className={styles.notFoundPage}
      aria-labelledby="not-found-title"
    >
      <ErrorScreen
        title="Страница не найдена"
        titleId="not-found-title"
        action={<Link to="/map">Вернуться к карте</Link>}
      />
    </main>
  );
}
