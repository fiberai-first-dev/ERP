import { api } from "./api";

export interface DashboardSummary {
  products: number;
  outOfStock: number;
  openOrders: number;
  ordersByStatus: Record<string, number>;
  ordersByChannel: Record<string, number>;
  channels: Array<{
    channel: string;
    status: string;
    lastSyncAt: string | null;
    lastSyncStatus: string | null;
    lastError: string | null;
  }>;
  recentOrders: Array<{
    id: string;
    marketplace: string;
    status: string;
    createdAt: string;
    itemCount: number;
  }>;
}

export async function getDashboardSummary() {
  return api<DashboardSummary>("/api/dashboard/summary");
}
