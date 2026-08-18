import { channelManager } from "../services/ChannelManager.js";
import { orderRepository } from "../repositories/order.repository.js";
import { shipmentRepository } from "../repositories/shipment.repository.js";
import { channelRepository } from "../repositories/channel.repository.js";
import { ChannelType } from "../models/domain.js";
import { logger } from "../utils/logger.js";
import { orderService } from "../services/OrderService.js";
import {
  decryptLogisticsCredentials,
  defaultLogisticsProvider,
  resolveLogisticsProvider,
} from "../adapters/logisticsRegistry/index.js";
import {
  defaultFulfillmentMethodId,
  getFulfillmentMethod,
} from "../adapters/salesChannelRegistry/fulfillmentMethods.js";

export async function syncShipments() {
  const orders = await orderRepository.list();
  const open = orders.filter(
    (o) =>
      [
        "SHIPMENT_CREATED",
        "PICKUP_SCHEDULED",
        "PICKED_UP",
        "IN_TRANSIT",
        "OUT_FOR_DELIVERY",
      ].includes(o.status) && o.channelConfigId
  );

  for (const order of open) {
    if (!["AMAZON", "FLIPKART", "SHOPIFY"].includes(String(order.marketplace))) continue;
    try {
      const channel = order.marketplace as ChannelType;
      const config = order.channelConfigId
        ? await channelRepository.findById(order.channelConfigId)
        : await channelRepository.findByChannel(channel);
      const method =
        getFulfillmentMethod(
          channel,
          config?.fulfillmentMethod || defaultFulfillmentMethodId(channel)
        )!;
      const logisticsProvider = method.requiresLogisticsProvider
        ? config?.logisticsProvider || defaultLogisticsProvider(channel)
        : null;
      const provider = resolveLogisticsProvider(logisticsProvider);
      const adapter = await channelManager.getAdapter(channel);
      const result = await provider.sync(order, adapter, {
        logisticsProvider,
        logisticsCredentials: config
          ? decryptLogisticsCredentials(config.logisticsCredentialsEncrypted)
          : null,
      });

      if (result.shipment) {
        await shipmentRepository.upsertForOrder({
          orderId: order.id,
          channelShipmentId: result.shipment.channelShipmentId,
          status: result.shipment.status,
          fulfillmentType: result.shipment.fulfillmentType || logisticsProvider,
          carrier: result.shipment.carrier,
          trackingNumber: result.shipment.trackingNumber,
          metadata: {
            ...(result.shipment.metadata || {}),
            logisticsMode: provider.mode,
            logisticsProvider,
          },
          shippedAt: result.shipment.shippedAt,
          deliveredAt: result.shipment.deliveredAt,
        });
      }

      if (!result.suggestedOrderStatus) continue;

      const source = channel;
      if (result.suggestedOrderStatus === "DELIVERED" && order.status !== "DELIVERED") {
        await orderService.applyStatusChange(order.id, "DELIVERED", source, {
          skipTransitionCheck: true,
          timestamps: { deliveredAt: result.deliveredAt || new Date().toISOString() },
        });
      } else if (
        result.suggestedOrderStatus === "DELIVERY_FAILED" &&
        order.status !== "DELIVERY_FAILED"
      ) {
        await orderService.applyStatusChange(order.id, "DELIVERY_FAILED", source, {
          skipTransitionCheck: true,
          timestamps: { deliveredAt: result.deliveredAt || new Date().toISOString() },
        });
      } else if (
        result.suggestedOrderStatus === "IN_TRANSIT" &&
        order.status !== "IN_TRANSIT" &&
        order.status !== "OUT_FOR_DELIVERY"
      ) {
        await orderService.applyStatusChange(order.id, "IN_TRANSIT", source, {
          skipTransitionCheck: true,
          timestamps: { shippedAt: result.shippedAt || new Date().toISOString() },
        });
      } else if (result.suggestedOrderStatus === "PICKED_UP" && order.status !== "PICKED_UP") {
        await orderService.applyStatusChange(order.id, "PICKED_UP", source, {
          skipTransitionCheck: true,
          timestamps: { shippedAt: result.shippedAt || new Date().toISOString() },
        });
      }
    } catch (error) {
      logger.warn({ orderId: order.id, err: error }, "Shipment sync failed");
    }
  }
}
