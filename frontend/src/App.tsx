import { Navigate, Route, Routes } from "react-router-dom";
import PublicLayout from "@/pages/public/PublicLayout";
import LoginPage from "@/pages/public/LoginPage";
import PrivateLayout from "@/pages/private/PrivateLayout";
import DashboardPage from "@/pages/private/DashboardPage";
import OrdersPage from "@/pages/private/OrdersPage";
import InventoryPage from "@/pages/private/InventoryPage";
import SettingsPage from "@/pages/private/SettingsPage";
import SimulationPage from "@/pages/private/SimulationPage";

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LoginPage />} />
      </Route>

      <Route element={<PrivateLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/simulation" element={<SimulationPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
