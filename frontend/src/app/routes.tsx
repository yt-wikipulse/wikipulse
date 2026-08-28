import { Navigate, Route, Routes } from "react-router-dom";

import { DashboardPage } from "../pages/DashboardPage";
import { LiveMapPage } from "../pages/LiveMapPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { AppShell } from "./AppShell";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/map" replace />} />
        <Route path="map" element={<LiveMapPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
      </Route>
      <Route element={<AppShell showTabs={false} />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
