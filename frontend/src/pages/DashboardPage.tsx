import styles from "./DashboardPage.module.scss";

export function DashboardPage() {
  return (
    <main
      className={styles.root}
      aria-labelledby="dashboard-title"
    >
      <h1 id="dashboard-title">Дашборд</h1>
      <p>
        Аналитика появится после согласования исторического источника данных.
      </p>
    </main>
  );
}