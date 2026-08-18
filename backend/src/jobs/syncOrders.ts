import { channelManager } from "../services/ChannelManager.js";
import { channelRepository } from "../repositories/channel.repository.js";
import { orderService } from "../services/OrderService.js";
import { ChannelType } from "../models/domain.js";
import { logger } from "../utils/logger.js";
import { publishEvent } from "../events/eventBus.js";

export async function syncOrdersForChannel(channel: ChannelType) {
  const config = await channelRepository.findByChannel(channel);
  if (!config || config.status !== "CONNECTED") {
    throw new Error(`${channel} is not connected`);
  }
  if (!config.enabled) {
    throw new Error(`${channel} is disabled`);
  }

  const adapter = await channelManager.getAdapter(channel);
  if (!adapter) throw new Error(`${channel} adapter unavailable`);

  try {
    const orders = await adapter.getOrders();
    for (const order of orders) {
      await orderService.ingestAdapterOrder(config.id, channel, order);
    }
    await channelRepository.recordSync(channel, "ORDERS_OK");
    await publishEvent({
      type: "channel.sync",
      payload: { channel, status: "ORDERS_OK" },
    });
    logger.info({ channel, count: orders.length }, "Orders synced");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Order sync failed";
    await channelRepository.recordSync(channel, "ORDERS_FAILED", message);
    await publishEvent({
      type: "channel.sync",
      payload: { channel, status: "ORDERS_FAILED", error: message },
    });
    throw error;
  }
}

export async function syncAllOrders() {
  const adapters = await channelManager.getConnectedAdapters();
  await Promise.all(
    adapters.map(async (adapter) => {
      try {
        await syncOrdersForChannel(adapter.channel);
      } catch (error) {
        logger.warn({ channel: adapter.channel, err: error }, "Order sync failed for channel");
      }
    })
  );
}
