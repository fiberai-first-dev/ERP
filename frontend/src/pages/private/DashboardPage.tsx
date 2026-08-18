import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { getDashboardSummary, DashboardSummary } from "@/services/dashboard.service";
import { AlertTriangle, Package, Warehouse } from "lucide-react";

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setData(await getDashboardSummary());
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const awaiting = (data?.ordersByStatus?.READY_TO_PACK || 0) + (data?.ordersByStatus?.NEW || 0) + (data?.ordersByStatus?.CONFIRMED || 0);
  const shipping = (data?.ordersByStatus?.SHIPMENT_CREATED || 0) + (data?.ordersByStatus?.PICKUP_SCHEDULED || 0);
  const transit = (data?.ordersByStatus?.IN_TRANSIT || 0) + (data?.ordersByStatus?.PICKED_UP || 0) + (data?.ordersByStatus?.OUT_FOR_DELIVERY || 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Dashboard"
      />

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-3 rounded-lg shadow-xl text-sm">
          {toast}
        </div>
      )}

      {loading || !data ? (
        <div className="text-sm text-gray-500">Loading overview...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: "Open orders", value: data.openOrders, icon: Package, href: "/orders" },
              { label: "Ready to pack", value: awaiting, icon: Package, href: "/orders" },
              { label: "Products", value: data.products, icon: Warehouse, href: "/inventory" },
              { label: "Out of stock", value: data.outOfStock, icon: AlertTriangle, href: "/inventory" },
            ].map((card) => (
              <Link
                key={card.label}
                to={card.href}
                className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5 hover:border-gray-300 dark:hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500 dark:text-neutral-400">{card.label}</span>
                  <card.icon className="w-4 h-4 text-gray-400" />
                </div>
                <div className="text-3xl font-semibold text-gray-900 dark:text-neutral-100">{card.value}</div>
              </Link>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <section className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-neutral-100">Channel health</h3>
                <Link to="/settings" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-neutral-100">
                  Manage
                </Link>
              </div>
              <div className="space-y-3">
                {data.channels.map((ch) => (
                  <div
                    key={ch.channel}
                    className="flex items-start justify-between gap-3 border border-gray-100 dark:border-neutral-800 rounded-lg px-3 py-3"
                  >
                    <div>
                      <div className="font-medium text-gray-900 dark:text-neutral-100">{ch.channel}</div>
                      {ch.status === "CONNECTED" && ch.lastError && (
                        <div className="text-xs text-red-500 mt-1">{ch.lastError}</div>
                      )}
                    </div>
                    <Badge
                      variant={
                        ch.status === "CONNECTED"
                          ? "success"
                          : ch.status === "ERROR"
                            ? "danger"
                            : "secondary"
                      }
                    >
                      {ch.status === "CONNECTED"
                        ? "Connected"
                        : ch.status === "ERROR"
                          ? "Error"
                          : "Not connected"}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-neutral-100">Order pipeline</h3>
                <Link to="/orders" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-neutral-100">
                  Open board
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Pack", value: awaiting },
                  { label: "Ship", value: shipping },
                  { label: "Transit", value: transit },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-gray-50 dark:bg-neutral-950 px-3 py-4 text-center">
                    <div className="text-2xl font-semibold text-gray-900 dark:text-neutral-100">{item.value}</div>
                    <div className="text-xs text-gray-500 mt-1">{item.label}</div>
                  </div>
                ))}
              </div>

              <div className="pt-2 space-y-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-neutral-300">Recent orders</h4>
                {data.recentOrders.length === 0 ? (
                  <p className="text-sm text-gray-500">No orders yet. Connect a channel in Settings.</p>
                ) : (
                  data.recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between text-sm border-t border-gray-100 dark:border-neutral-800 pt-2"
                    >
                      <div>
                        <div className="font-medium text-gray-900 dark:text-neutral-100">{order.id.slice(0, 8)}…</div>
                        <div className="text-xs text-gray-500">
                          {order.marketplace} · {order.itemCount} items
                        </div>
                      </div>
                      <Badge variant="secondary">{statusLabel(order.status)}</Badge>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
