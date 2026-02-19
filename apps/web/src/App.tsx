import { BrowserRouter, Routes, Route } from "react-router-dom";
import RequireAuth from "./auth/RequireAuth";
import AppLayout from "./layouts/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import EntreePage from "./pages/EntreePage";
import ParkingPage from "./pages/ParkingPage";
import SortiePage from "./pages/SortiePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="entree" element={<EntreePage role="superuser" />} />
          <Route path="parking" element={<ParkingPage />} />
          <Route path="sortie" element={<SortiePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
