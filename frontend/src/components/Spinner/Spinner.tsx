import styles from "./Spinner.module.scss";

type SpinnerProps = {
  label: string;
};

export function Spinner({ label }: SpinnerProps) {
  return <div className={styles.spinner} role="status" aria-label={label} />;
}
