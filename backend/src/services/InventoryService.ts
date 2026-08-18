import { z } from "zod";
import { productRepository } from "../repositories/product.repository.js";
import { channelManager } from "./ChannelManager.js";
import { channelRepository } from "../repositories/channel.repository.js";
import { AppError } from "../middleware/errorHandler.js";
import { logger } from "../utils/logger.js";
import { Product } from "../models/domain.js";
import { publishEvent } from "../events/eventBus.js";
import { ProductSyncInput } from "../adapters/salesChannelRegistry/SalesChannelAdapter.js";

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  price: z.number().nonnegative(),
  quantity: z.number().int().nonnegative(),
  description: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
});

function toFrontendInventory(
  product: Product,
  channelSync?: Array<{ channel: string; ok: boolean; error?: string }>
) {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    quantity: product.quantity,
    price: product.price,
    description: product.description,
    imageUrl: product.imageUrl,
    ...(channelSync ? { channelSync } : {}),
  };
}

function normalizeImageUrl(value?: string | null) {
  if (!value) return null;
  return value.trim() || null;
}

function toProductSyncInput(product: Product): ProductSyncInput {
  return {
    sku: product.sku,
    name: product.name,
    price: product.price,
    quantity: product.quantity,
    description: product.description,
    imageUrl: product.imageUrl,
  };
}

export class InventoryService {
  async list() {
    const products = await productRepository.list();
    return products.map((product) => toFrontendInventory(product));
  }

  async create(body: unknown) {
    const input = productSchema.parse(body);
    const product = await productRepository.create({
      ...input,
      imageUrl: normalizeImageUrl(input.imageUrl),
    });
    await publishEvent({
      type: "inventory.created",
      payload: { productId: product.id, sku: product.sku, quantity: product.quantity },
    });
    const channelSync = await this.syncProductToChannels(product);
    return toFrontendInventory(product, channelSync);
  }

  async update(id: string, body: unknown) {
    const input = productSchema.partial().parse(body);
    const product = await productRepository.update(id, {
      ...input,
      imageUrl:
        input.imageUrl !== undefined ? normalizeImageUrl(input.imageUrl) : undefined,
    });
    if (!product) throw new AppError("Product not found", 404);
    await publishEvent({
      type: "inventory.updated",
      payload: { productId: product.id, sku: product.sku, quantity: product.quantity },
    });
    const channelSync = await this.syncProductToChannels(product);
    return toFrontendInventory(product, channelSync);
  }

  async delete(id: string) {
    const existing = await productRepository.findById(id);
    const ok = await productRepository.delete(id);
    if (!ok) throw new AppError("Product not found", 404);
    await publishEvent({
      type: "inventory.deleted",
      payload: { productId: id, sku: existing?.sku },
    });
  }

  async adjust(id: string, delta: number) {
    if (!Number.isInteger(delta)) throw new AppError("delta must be an integer", 400);
    const product = await productRepository.adjustQuantity(id, delta);
    if (!product) throw new AppError("Product not found", 404);
    await publishEvent({
      type: "inventory.adjusted",
      payload: { productId: product.id, sku: product.sku, quantity: product.quantity },
    });
    const channelSync = await this.syncProductToChannels(product);
    return toFrontendInventory(product, channelSync);
  }

  async bulkReplace(items: Array<{ id: string; name: string; quantity: number }>) {
    const updated = [];
    for (const item of items) {
      const product = await productRepository.update(item.id, {
        name: item.name,
        quantity: item.quantity,
      });
      if (product) {
        await publishEvent({
          type: "inventory.updated",
          payload: {
            productId: product.id,
            sku: product.sku,
            quantity: product.quantity,
          },
        });
        const channelSync = await this.syncProductToChannels(product);
        updated.push(toFrontendInventory(product, channelSync));
      }
    }
    return updated;
  }

  async pushAllToChannels() {
    const products = await productRepository.list();
    const summary: Array<{ sku: string; results: Array<{ channel: string; ok: boolean; error?: string }> }> = [];

    for (const product of products) {
      const results = await this.syncProductToChannels(product);
      summary.push({ sku: product.sku, results });
    }

    return { pushed: products.length, summary };
  }

  /** Non-blocking channel sync so +/- / save stay snappy in the UI. */
  private queueChannelSync(product: Product) {
    void this.syncProductToChannels(product).catch((error) => {
      logger.warn({ err: error, sku: product.sku }, "Background channel product sync failed");
    });
  }

  async syncProductToChannels(product: Product) {
    const adapters = await channelManager.getConnectedAdapters();
    const payload = toProductSyncInput(product);
    const results: Array<{ channel: string; ok: boolean; error?: string }> = [];

    await Promise.all(
      adapters.map(async (adapter) => {
        try {
          if (adapter.upsertProduct) {
            await adapter.upsertProduct(payload);
          } else {
            await adapter.updateInventory({ sku: payload.sku, quantity: payload.quantity });
          }
          results.push({ channel: adapter.channel, ok: true });
          await channelRepository.recordSync(adapter.channel, "INVENTORY_OK");
          await publishEvent({
            type: "channel.sync",
            payload: { channel: adapter.channel, status: "INVENTORY_OK" },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Inventory sync failed";
          logger.warn({ channel: adapter.channel, sku: product.sku, err: error }, "Channel product sync failed");
          results.push({ channel: adapter.channel, ok: false, error: message });
          await channelRepository.recordSync(adapter.channel, "INVENTORY_FAILED", message);
          await publishEvent({
            type: "channel.sync",
            payload: { channel: adapter.channel, status: "INVENTORY_FAILED", error: message },
          });
        }
      })
    );

    return results;
  }

  /** @deprecated prefer syncProductToChannels — kept for callers that only have sku/qty */
  async propagateQuantity(sku: string, quantity: number) {
    const product = await productRepository.findBySku(sku);
    if (product) {
      return this.syncProductToChannels({ ...product, quantity });
    }
    const adapters = await channelManager.getConnectedAdapters();
    const results: Array<{ channel: string; ok: boolean; error?: string }> = [];
    await Promise.all(
      adapters.map(async (adapter) => {
        try {
          await adapter.updateInventory({ sku, quantity });
          results.push({ channel: adapter.channel, ok: true });
        } catch (error) {
          results.push({
            channel: adapter.channel,
            ok: false,
            error: error instanceof Error ? error.message : "Inventory sync failed",
          });
        }
      })
    );
    return results;
  }
}

export const inventoryService = new InventoryService();
