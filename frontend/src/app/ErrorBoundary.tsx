import { Component, type ReactNode } from "react";

import { ErrorScreen } from "../components/ErrorScreen/ErrorScreen";
import styles from "./ErrorBoundary.module.scss";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  failed: boolean;
};

/**
 * Граница ошибок вокруг маршрутов, а не вокруг всего приложения: шапка
 * остаётся живой, и с экрана ошибки можно уйти на другой маршрут. Без границы
 * любое исключение в рендере уносит весь `#root` в белый экран — React
 * размонтирует дерево целиком.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }

    return (
      <div className={styles.errorBoundary}>
        <ErrorScreen
          title="Что-то пошло не так"
          description="Интерфейс не смог отрисоваться. Перезагрузите страницу — данные не потеряются."
          action={
            <button
              type="button"
              onClick={() => window.location.reload()}
            >
              Перезагрузить
            </button>
          }
        />
      </div>
    );
  }
}
