import { useCallback, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { Header } from "../components/Header/Header";
import type { AppShellContext } from "./appShellContext";
import styles from "./AppShell.module.scss";

export function AppShell() {
    const [isNearestEditOpen, setIsNearestEditOpen] = useState(false);

    const location = useLocation();

    const isMapRoute = location.pathname === "/map";

    const closeNearestEdit = useCallback(() => {
        setIsNearestEditOpen(false);
    }, []);

    const toggleNearestEdit = useCallback(() => {
        setIsNearestEditOpen((current) => !current);
    }, []);

    const context = useMemo<AppShellContext>(
        () => ({
            isNearestEditOpen: isNearestEditOpen && isMapRoute,
            closeNearestEdit,
        }),
        [isNearestEditOpen, isMapRoute, closeNearestEdit],
    );

    return (
        <div className={styles.appShell}>
            <Header
                showNearestEdit={isMapRoute}
                isNearestEditOpen={isNearestEditOpen}
                onNearestEditClick={toggleNearestEdit}
            />
            <div className={styles.appShell__content}>
                <Outlet context={context} />
            </div>
        </div>
    )
}
