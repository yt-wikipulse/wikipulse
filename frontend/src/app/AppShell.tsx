import { Outlet } from "react-router-dom";

import { Header } from "../components/Header/Header";
import styles from "./AppShell.module.scss";

export function AppShell() {
    return (
        <div className={styles.root}>
            <Header />
            <div className={styles.content}>
                <Outlet />
            </div>
        </div>
    )
}