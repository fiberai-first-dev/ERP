import { api } from "./api";
import { Order, OrderStatus } from "@/types";

export interface SimulationAction {
  targetStatus: OrderStatus;
  label: string;
}

export interface LogisticsOrder extends Order {
  actions: SimulationAction[];
}

export async function getSimulationConfig(): Promise<{
  enabled: boolean;
  notes: Record<string, string>;
}> {
  return api("/api/simulation/config");
}

export async function getLogisticsOrders(channel?: string): Promise<LogisticsOrder[]> {
  const qs = channel && channel !== "ALL" ? `?channel=${encodeURIComponent(channel)}` : "";
  return api(`/api/simulation/logistics-orders${qs}`);
}

export async function placeSimulatedOrder(payload: {
  channel: string;
  items: { productId: string; quantity: number }[];
  customer?: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
}): Promise<{ order: Order; createdOnChannel: boolean; note: string | null }> {
  return api("/api/simulation/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function transitionSimulatedOrder(
  orderId: string,
  targetStatus: OrderStatus
): Promise<{
  order: LogisticsOrder;
  source: string;
  previousStatus: string;
  newStatus: string;
}> {
  return api(`/api/simulation/orders/${orderId}/transition`, {
    method: "POST",
    body: JSON.stringify({ targetStatus }),
  });
}
