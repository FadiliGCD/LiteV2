import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import RequireAuth from "./auth/RequireAuth";
import RequireModule from "./auth/RequireModule";
import AppLayout from "./layouts/AppLayout";

import LoginPage from "./pages/LoginPage";
import ModulesPage from "./pages/ModulesPage";
import DashboardPage from "./pages/DashboardPage";
import EntreePage from "./pages/EntreePage";
import ParkingPage from "./pages/ParkingPage";
import SortiePage from "./pages/SortiePage";
import RapportDeChargePage from "./pages/RapportDeChargePage";
import PointagePage from "./pages/PointagePage";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

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

          <Route path="entree" element={<EntreePage role="superuser" />} />

          <Route path="parking" element={<ParkingPage />} />

          <Route path="sortie" element={<SortiePage />} />

          <Route path="rapport-charge" element={<RapportDeChargePage />} />
        </Route>

        <Route
          path="/pointage"
          element={
            <RequireAuth>
              <RequireModule moduleKey="pointage">
                <PointagePage />
              </RequireModule>
            </RequireAuth>
          }
        />

        <Route path="/" element={<Navigate to="/modules" replace />} />

        <Route path="*" element={<Navigate to="/modules" replace />} />
      </Routes>
    </BrowserRouter>
  );
}