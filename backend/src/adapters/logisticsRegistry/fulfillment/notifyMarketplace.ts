import { ChannelAdapter } from "../../salesChannelRegistry/SalesChannelAdapter.js";
import { OrderStatus } from "../../../models/domain.js";
import { logger } from "../../../utils/logger.js";

/**
 * Gracefully push Self-Ship / merchant logistics status to the ecommerce channel.
 * Failures are logged and never block ERM status updates.
 */
export async function notifyMarketplaceSelfShip(
  adapter: ChannelAdapter | null | undefined,
  input: {
    channelOrderId: string;
    trackingNumber?: string | null;
    carrier?: string | null;
    orderStatus: OrderStatus;
  }
): Promise<void> {
  if (!adapter?.fulfillOrder) return;
  try {
    await adapter.fulfillOrder({
      channelOrderId: input.channelOrderId,
      action: "UPDATE_SHIPMENT",
      trackingNumber: input.trackingNumber || undefined,
      carrier: input.carrier || undefined,
      orderStatus: input.orderStatus,
    });
  } catch (error) {
    logger.warn(
      {
        channel: adapter.channel,
        channelOrderId: input.channelOrderId,
        orderStatus: input.orderStatus,
        err: error,
      },
      "Failed to notify marketplace of Self-Ship status (non-blocking)"
    );
  }
}
