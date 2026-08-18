import { orderRepository } from "../repositories/order.repository.js";
import { productRepository } from "../repositories/product.repository.js";
import { channelRepository } from "../repositories/channel.repository.js";

export class DashboardService {
  async summary() {
    const [orders, products, channels, outOfStock] = await Promise.all([
      orderRepository.list(),
      productRepository.list(),
      channelRepository.list(),
      productRepository.countOutOfStock(),
    ]);

    const byStatus: Record<string, number> = {};
    const byChannel: Record<string, number> = {};

    for (const order of orders) {
      byStatus[order.status] = (byStatus[order.status] || 0) + 1;
      const channel = String(order.marketplace || "UNKNOWN");
      byChannel[channel] = (byChannel[channel] || 0) + 1;
    }

    const openOrders = orders.filter((o) =>
      [
        "NEW",
        "CONFIRMED",
        "READY_TO_PACK",
        "PACKED",
        "SHIPMENT_CREATED",
        "PICKUP_SCHEDULED",
        "PICKED_UP",
        "IN_TRANSIT",
        "OUT_FOR_DELIVERY",
      ].includes(o.status)
    ).length;

    return {
      products: products.length,
      outOfStock,
      openOrders,
      ordersByStatus: byStatus,
      ordersByChannel: byChannel,
      channels: channels.map((c) => ({
        channel: c.channel,
        status: c.status,
        lastSyncAt: c.lastSyncAt,
        lastSyncStatus: c.lastSyncStatus,
        lastError: c.lastError,
      })),
      recentOrders: orders.slice(0, 8).map((o) => ({
        id: o.id,
        marketplace: o.marketplace,
        status: o.status,
        createdAt: o.createdAt,
        itemCount: o.items.length,
      })),
    };
  }
}

export const dashboardService = new DashboardService();
