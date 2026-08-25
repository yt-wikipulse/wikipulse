import styles from "./Spinner.module.scss";

type SpinnerProps = {
  label: string;
  size?: "small" | "large";
};

export function Spinner({ label, size = "small" }: SpinnerProps) {
  return (
    <div
      className={styles.spinner}
      data-size={size}
      role="status"
      aria-label={label}
    />
  );
}
