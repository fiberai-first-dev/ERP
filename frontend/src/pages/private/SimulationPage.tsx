import { useContext, useEffect, useMemo, useState } from "react";
import { AppContext } from "@/context/AppContext";
import { Marketplace, OrderStatus } from "@/types";
import MarketplaceCard from "@/components/MarketplaceCard";
import OrderDialog, { PlaceOrderPayload } from "@/components/OrderDialog";
import LogisticsOrderCard from "@/components/LogisticsOrderCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Package } from "lucide-react";
import { getChannels, ChannelSummary } from "@/services/channel.service";
import {
  getLogisticsOrders,
  getSimulationConfig,
  LogisticsOrder,
  placeSimulatedOrder,
  transitionSimulatedOrder,
} from "@/services/simulation.service";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { Badge } from "@/components/ui/Badge";

const ALL_CHANNELS: Marketplace[] = [Marketplace.AMAZON, Marketplace.SHOPIFY, Marketplace.FLIPKART];

export default function SimulationPage() {
  const ctx = useContext(AppContext);
  const inventories = ctx?.state.inventories || [];

  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMarketplace, setDialogMarketplace] = useState<Marketplace | "">("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<"success" | "error">("success");
  const [logistics, setLogistics] = useState<LogisticsOrder[]>([]);
  const [channelFilter, setChannelFilter] = useState<"ALL" | Marketplace>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);

  const connected = useMemo(
    () => new Set(channels.filter((c) => c.status === "CONNECTED").map((c) => c.channel)),
    [channels]
  );

  function showToast(msg: string, tone: "success" | "error" = "success") {
    setToastTone(tone);
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  }

  async function refreshLogistics() {
    try {
      const rows = await getLogisticsOrders(channelFilter);
      setLogistics(rows);
    } catch (err) {
      if (err instanceof Error && err.message.includes("disabled")) {
        setEnabled(false);
      }
    }
  }

  useEffect(() => {
    getChannels()
      .then(setChannels)
      .catch(() => setChannels([]));
    getSimulationConfig()
      .then((cfg) => setEnabled(cfg.enabled))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (enabled) void refreshLogistics();
  }, [enabled, channelFilter]);

  useRealtimeEvents((event) => {
    if (event.type.startsWith("order.") && enabled) {
      void refreshLogistics();
    }
  });

  const filteredLogistics = useMemo(() => {
    return logistics.filter((o) => (statusFilter === "ALL" ? true : o.status === statusFilter));
  }, [logistics, statusFilter]);

  function openDialog(marketplace: Marketplace) {
    if (!enabled) {
      showToast("Simulation mode is disabled");
      return;
    }
    if (!connected.has(marketplace)) {
      showToast(`Connect ${marketplace} in Settings before placing a test order.`);
      return;
    }
    setDialogMarketplace(marketplace);
    setDialogOpen(true);
  }

  async function placeOrder(payload: PlaceOrderPayload) {
    if (!dialogMarketplace) return;

    try {
      const result = await placeSimulatedOrder({
        channel: dialogMarketplace,
        items: payload.items.map((it) => ({
          productId: it.skuId,
          quantity: it.quantity,
        })),
        customer: {
          name: payload.customer.name || "ERM Test Customer",
          email: payload.customer.email || undefined,
          phone: payload.customer.phone || undefined,
          address: payload.customer.address || undefined,
        },
      });

      await ctx?.loadOrders();
      await ctx?.loadInventories();
      await refreshLogistics();
      setDialogOpen(false);
      showToast(result.note || "Order created successfully", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to place order";
      showToast(message, "error");
      throw err; // keep dialog open and let OrderDialog show inline error
    }
  }

  async function handleTransition(orderId: string, target: OrderStatus) {
    setBusyId(orderId);
    try {
      const result = await transitionSimulatedOrder(orderId, target);
      await ctx?.loadOrders();
      await refreshLogistics();
      showToast(`${result.previousStatus} → ${result.newStatus}`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Transition failed", "error");
    } finally {
      setBusyId(null);
    }
  }

  if (!enabled) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <PageHeader title="Simulation" description="Simulation mode is disabled." />
        <p className="text-sm text-gray-500">
          Set <code className="text-xs bg-gray-100 dark:bg-neutral-800 px-1 rounded">SIMULATION_MODE=true</code> on the
          backend to enable this page.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Simulation"
        description="Create test orders and advance logistics states. Transitions use the same path as real channel events."
        action={<Badge variant="warning">Simulation Mode</Badge>}
      />

      {toastMessage && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-xl px-4 py-3 rounded-lg shadow-xl text-sm ${
            toastTone === "error"
              ? "bg-red-600 text-white"
              : "bg-gray-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
          }`}
        >
          {toastMessage}
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100 mb-4">Create test order</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {ALL_CHANNELS.map((channel) => (
            <MarketplaceCard
              key={channel}
              name={channel === Marketplace.SHOPIFY ? "Shopify" : channel === Marketplace.AMAZON ? "Amazon" : "Flipkart"}
              inventories={inventories}
              onOpen={() => openDialog(channel)}
            />
          ))}
        </div>
      </div>

      <OrderDialog
        inventories={inventories}
        open={dialogOpen}
        marketplace={dialogMarketplace || "Channel"}
        showCustomerFields={dialogMarketplace === Marketplace.SHOPIFY}
        lockCustomer={dialogMarketplace === Marketplace.SHOPIFY}
        onClose={() => setDialogOpen(false)}
        onPlace={placeOrder}
      />

      <div className="pt-2 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100">Logistics board</h3>
            <span className="bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 text-xs font-semibold px-2 py-0.5 rounded-full">
              {filteredLogistics.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as "ALL" | Marketplace)}
              className="text-sm border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 bg-white dark:bg-neutral-900"
            >
              <option value="ALL">All channels</option>
              {ALL_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "ALL" | OrderStatus)}
              className="text-sm border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 bg-white dark:bg-neutral-900"
            >
              <option value="ALL">All logistics statuses</option>
              {[
                OrderStatus.PACKED,
                OrderStatus.SHIPMENT_CREATED,
                OrderStatus.PICKUP_SCHEDULED,
                OrderStatus.PICKED_UP,
                OrderStatus.IN_TRANSIT,
                OrderStatus.OUT_FOR_DELIVERY,
                OrderStatus.DELIVERED,
                OrderStatus.DELIVERY_FAILED,
                OrderStatus.RETURN_REQUESTED,
                OrderStatus.RETURNED,
              ].map((s) => (
                <option key={s} value={s}>
                  {s === OrderStatus.DELIVERY_FAILED ? "RTO" : s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredLogistics.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-gray-50 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-gray-300 dark:text-neutral-600" />
            </div>
            <h4 className="text-gray-900 dark:text-neutral-100 font-medium mb-1">No logistics-ready orders</h4>
            <p className="text-sm text-gray-500 dark:text-neutral-400 max-w-md">
              Pack an order on the Orders board (Ready to Pack → Packed), then advance logistics here with state-aware
              actions.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredLogistics.map((o) => (
              <LogisticsOrderCard
                key={o.id}
                order={o}
                actions={o.actions}
                busy={busyId === o.id}
                onTransition={handleTransition}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
