import { Link, useLocation, useNavigate } from "react-router-dom";
import { useContext, useState } from "react";
import { AppContext } from "@/context/AppContext";
import {
  LayoutDashboard,
  Package,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Warehouse,
  Settings,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout as logoutApi } from "@/services/auth.service";

export default function Sidebar() {
  const ctx = useContext(AppContext);
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname || "/";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleLogout() {
    try {
      logoutApi().catch(() => {});
    } finally {
      ctx?.logout();
      navigate("/");
    }
  }

  const items = [
    { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: "Orders", href: "/orders", icon: <Package className="w-5 h-5" /> },
    { label: "Inventory", href: "/inventory", icon: <Warehouse className="w-5 h-5" /> },
    { label: "Simulation", href: "/simulation", icon: <Activity className="w-5 h-5" /> },
  ];

  const settingsActive = pathname === "/settings" || pathname.startsWith("/settings/");

  function navLinkClass(active: boolean, mobile = false) {
    if (mobile) {
      return cn(
        "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors",
        active
          ? "bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
          : "text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900"
      );
    }
    return cn(
      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-neutral-700",
      active
        ? "bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-neutral-100"
        : "text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-neutral-100"
    );
  }

  return (
    <>
      <div className="md:hidden shrink-0 flex items-center justify-between px-4 py-3 border-b bg-white z-30">
        <div className="flex items-center gap-3">
          <button
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="p-1 -ml-1 text-gray-600 hover:text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-200"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="font-bold tracking-tight text-gray-900 flex items-center gap-2">ERM</div>
        </div>
      </div>

      <aside
        className={cn(
          "bg-white dark:bg-neutral-950 border-r border-gray-200 dark:border-neutral-800 hidden md:flex flex-col h-screen self-stretch shrink-0 transition-all duration-300 relative z-20",
          collapsed ? "w-20" : "w-56"
        )}
        aria-label="Sidebar"
      >
        <div className="h-16 shrink-0 flex items-center justify-between px-4 border-b border-gray-100 dark:border-neutral-800/50">
          <div className="flex items-center gap-3 overflow-hidden">
            {!collapsed && (
              <span className="font-bold tracking-tight text-gray-900 dark:text-neutral-100 text-lg whitespace-nowrap">
                ERM
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-full p-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-neutral-100 hover:bg-gray-50 dark:hover:bg-neutral-800 focus:outline-none shadow-sm transition-transform z-30"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <nav className="flex-1 min-h-0 px-3 py-6 space-y-1 overflow-y-auto" aria-label="Main">
          {items.map((it) => {
            const active = pathname === it.href || pathname.startsWith(it.href + "/");
            return (
              <Link
                key={it.href}
                to={it.href}
                className={navLinkClass(active)}
                title={collapsed ? it.label : undefined}
              >
                <span
                  className={cn(
                    "shrink-0 transition-colors",
                    active
                      ? "text-gray-900 dark:text-neutral-100"
                      : "text-gray-500 dark:text-neutral-500 group-hover:text-gray-900 dark:group-hover:text-neutral-100"
                  )}
                >
                  {it.icon}
                </span>
                {!collapsed && <span className="truncate">{it.label}</span>}
                {active && !collapsed && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-neutral-100" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 p-4 border-t border-gray-100 dark:border-neutral-800/50 flex flex-col gap-1">
          <Link
            to="/settings"
            className={cn(navLinkClass(settingsActive), collapsed && "justify-center")}
            title={collapsed ? "Settings" : undefined}
          >
            <Settings className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="truncate">Settings</span>}
            {settingsActive && !collapsed && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-neutral-100" />
            )}
          </Link>
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900 hover:text-red-600 dark:hover:text-red-400 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-neutral-700",
              collapsed && "justify-center"
            )}
            title={collapsed ? "Logout" : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && "Logout"}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="relative flex-1 w-full max-w-[280px] bg-white dark:bg-neutral-950 h-full shadow-xl flex flex-col">
            <div className="h-16 shrink-0 flex items-center justify-between px-4 border-b border-gray-100 dark:border-neutral-800/50">
              <span className="font-bold tracking-tight text-gray-900 dark:text-neutral-100 text-lg">ERM</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 -mr-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 min-h-0 px-3 py-6 space-y-1 overflow-y-auto">
              {items.map((it) => {
                const active = pathname === it.href || pathname.startsWith(it.href + "/");
                return (
                  <Link
                    key={it.href}
                    to={it.href}
                    onClick={() => setMobileOpen(false)}
                    className={navLinkClass(active, true)}
                  >
                    {it.icon}
                    <span>{it.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="shrink-0 p-4 border-t border-gray-100 dark:border-neutral-800/50 space-y-2">
              <Link
                to="/settings"
                onClick={() => setMobileOpen(false)}
                className={navLinkClass(settingsActive, true)}
              >
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 rounded-xl px-4 py-3"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
