import type { ReactNode } from "react";

import errorIllustration from "../../assets/error.svg";

import styles from "./ErrorScreen.module.scss";

type ErrorScreenProps = {
  title: string;
  titleId?: string;
  description?: string;
  action: ReactNode;
};

export function ErrorScreen({
  title,
  titleId,
  description,
  action,
}: ErrorScreenProps) {
  return (
    <div className={styles.errorScreen}>
      <img
        className={styles.errorScreen__illustration}
        src={errorIllustration}
        alt=""
        aria-hidden="true"
      />

      <h1 id={titleId}>{title}</h1>

      {description !== undefined && (
        <p className={styles.errorScreen__description}>{description}</p>
      )}

      {action}
    </div>
  );
}
