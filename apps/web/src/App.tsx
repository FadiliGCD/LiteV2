import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import MainDoeuvrePage from "./pages/MainDoeuvrePage";

import RequireAuth from "./auth/RequireAuth";
import RequireModule from "./auth/RequireModule";
import RequireHrAccess from "./auth/RequireHrAccess";
import AppLayout from "./layouts/AppLayout";

import LoginPage from "./pages/LoginPage";
import ModulesPage from "./pages/ModulesPage";
import HrPage from "./pages/HrPage";
import DashboardPage from "./pages/DashboardPage";
import EntreePage from "./pages/EntreePage";
import ParkingPage from "./pages/ParkingPage";
import SortiePage from "./pages/SortiePage";
import RapportDeChargePage from "./pages/RapportDeChargePage";
import PointagePage from "./pages/PointagePage";
import ChangePasswordPage from "./pages/ChangePasswordPage";

import RequireSuperuser from "./auth/RequireSuperuser";
import SettingsPage from "./pages/SettingsPage";

import AppVersionGuard from "./components/AppVersionGuard";
import PasswordChangeGuard from "./components/PasswordChangeGuard";

export default function App() {
  return (
    <BrowserRouter>
      <AppVersionGuard />
      <PasswordChangeGuard />

      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/change-password"
          element={
            <RequireAuth>
              <ChangePasswordPage />
            </RequireAuth>
          }
        />

        <Route
          path="/modules"
          element={
            <RequireAuth>
              <ModulesPage />
            </RequireAuth>
          }
        />

        <Route
          path="/stock"
          element={
            <RequireAuth>
              <RequireModule moduleKey="stock">
                <AppLayout />
              </RequireModule>
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="entree" element={<EntreePage />} />
          <Route path="parking" element={<ParkingPage />} />
          <Route path="sortie" element={<SortiePage />} />
          <Route path="rapport-charge" element={<RapportDeChargePage />} />
        </Route>

        <Route
          path="/hr"
          element={
            <RequireAuth>
              <RequireModule moduleKey="hr">
                <HrPage />
              </RequireModule>
            </RequireAuth>
          }
        />

        <Route
          path="/hr/pointage"
          element={
            <RequireAuth>
              <RequireModule moduleKey="hr">
                <RequireHrAccess accessKey="pointage">
                  <PointagePage />
                </RequireHrAccess>
              </RequireModule>
            </RequireAuth>
          }
        />

        <Route
          path="/hr/main-doeuvre"
          element={
            <RequireAuth>
              <RequireModule moduleKey="hr">
                <RequireHrAccess accessKey="main_doeuvre">
                  <MainDoeuvrePage />
                </RequireHrAccess>
              </RequireModule>
            </RequireAuth>
          }
        />

        <Route
          path="/settings"
          element={
            <RequireAuth>
              <RequireSuperuser>
                <SettingsPage />
              </RequireSuperuser>
            </RequireAuth>
          }
        />

        {/* old pointage route redirected to new HR route */}
        <Route path="/pointage" element={<Navigate to="/hr/pointage" replace />} />

        <Route path="/" element={<Navigate to="/modules" replace />} />

        <Route path="*" element={<Navigate to="/modules" replace />} />
      </Routes>
    </BrowserRouter>
  );
}