import { useContext, useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import AppProvider from "@/context/AppProvider";
import Sidebar from "@/components/Sidebar";
import { AppContext } from "@/context/AppContext";

export default function PrivateLayout() {
  return (
    <AppProvider>
      <InnerLayout />
    </AppProvider>
  );
}

function InnerLayout() {
  const ctx = useContext(AppContext);
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("isLoggedIn") === "true";
    if (!saved) navigate("/", { replace: true });
  }, [ctx?.state?.isLoggedIn, navigate]);

  if (!mounted) return null;

  const clientLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  if (!ctx?.state?.isLoggedIn && !clientLoggedIn) return null;

  return (
    <div className="flex flex-col md:flex-row h-screen min-h-0 overflow-hidden">
      <Sidebar />
      <main className="flex-1 w-full min-w-0 min-h-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
