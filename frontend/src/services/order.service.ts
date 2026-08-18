import { Order } from "@/types";
import { api } from "./api";

export async function getOrders(): Promise<Order[]> {
  return api<Order[]>("/api/orders");
}

export async function addOrder(order: Order): Promise<Order> {
  return api<Order>("/api/orders", {
    method: "POST",
    body: JSON.stringify(order),
  });
}

export async function updateOrder(order: Order): Promise<Order> {
  return api<Order>(`/api/orders/${order.id}`, {
    method: "PUT",
    body: JSON.stringify(order),
  });
}

export type PickupSlotOption = {
  id: string;
  label: string;
  startsAt: string;
  endsAt?: string;
};

export type PickupSlotsResponse = {
  orderId: string;
  logisticsProvider: string;
  trackingNumber?: string | null;
  carrier?: string | null;
  labelUrl?: string | null;
  slots: PickupSlotOption[];
  canSchedule: boolean;
  reason?: string;
};

export async function getPickupSlots(orderId: string): Promise<PickupSlotsResponse> {
  return api<PickupSlotsResponse>(`/api/orders/${orderId}/pickup-slots`);
}

export async function schedulePickup(
  orderId: string,
  input: { pickupSlotId?: string; pickupDate?: string }
): Promise<Order> {
  return api<Order>(`/api/orders/${orderId}/schedule-pickup`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
