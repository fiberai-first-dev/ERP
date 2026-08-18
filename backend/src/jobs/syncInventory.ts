import { channelManager } from "../services/ChannelManager.js";
import { productRepository } from "../repositories/product.repository.js";
import { channelRepository } from "../repositories/channel.repository.js";
import { logger } from "../utils/logger.js";
import { publishEvent } from "../events/eventBus.js";

export async function syncInventoryToChannels() {
  const products = await productRepository.list();
  const adapters = await channelManager.getConnectedAdapters();

  for (const adapter of adapters) {
    let synced = 0;
    let skippedMissing = 0;
    try {
      for (const product of products) {
        try {
          await adapter.updateInventory({ sku: product.sku, quantity: product.quantity });
          synced += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Inventory sync failed";
          const status =
            error && typeof error === "object" && "status" in error
              ? Number((error as { status?: number }).status)
              : undefined;

          // SKU not on channel — skip; do not mark whole channel as failed.
          if (status === 404 || /not found/i.test(message)) {
            skippedMissing += 1;
            continue;
          }

          // Hard permission / auth failure — stop this channel and surface a clear error.
          throw error;
        }
      }
      await channelRepository.recordSync(adapter.channel, "INVENTORY_OK", null);
      await publishEvent({
        type: "channel.sync",
        payload: { channel: adapter.channel, status: "INVENTORY_OK" },
      });
      if (skippedMissing > 0) {
        logger.info(
          { channel: adapter.channel, synced, skippedMissing },
          "Inventory sync completed with missing SKUs skipped"
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Inventory sync failed";
      await channelRepository.recordSync(adapter.channel, "INVENTORY_FAILED", message);
      await publishEvent({
        type: "channel.sync",
        payload: { channel: adapter.channel, status: "INVENTORY_FAILED", error: message },
      });
      logger.warn({ channel: adapter.channel, err: error }, "Inventory sync failed");
    }
  }
}
