import { z } from "zod";
import { channelRepository } from "../repositories/channel.repository.js";
import { productRepository } from "../repositories/product.repository.js";
import { orderRepository } from "../repositories/order.repository.js";
import { channelManager } from "./ChannelManager.js";
import { orderService } from "./OrderService.js";
import { inventoryService } from "./InventoryService.js";
import { AppError } from "../middleware/errorHandler.js";
import { AdapterOrder, CreateTestOrderResult } from "../adapters/salesChannelRegistry/SalesChannelAdapter.js";
import { ChannelType, OrderStatus } from "../models/domain.js";
import { env } from "../config/env.js";
import {
  assertValidTransition,
  getSimulationActions,
  isLogisticsEligible,
  toCanonicalStatus,
} from "./orderLifecycle.js";
import {
  defaultLogisticsProvider,
  isExternalLogisticsProvider,
  isChannelNativeFulfillmentMethod,
  notifyMarketplaceSelfShip,
  resolveLogisticsProvider,
  SHOPIFY_SIM_CUSTOMER,
} from "../adapters/logisticsRegistry/index.js";
import {
  defaultFulfillmentMethodId,
  getFulfillmentMethod,
} from "../adapters/salesChannelRegistry/fulfillmentMethods.js";

const placeSchema = z.object({
  channel: z.enum(["AMAZON", "FLIPKART", "SHOPIFY"]),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  customer: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
});

const transitionSchema = z.object({
  targetStatus: z.string().min(1),
});

function assertSimulationEnabled() {
  if (!env.simulationMode) {
    throw new AppError("Logistics Simulation is disabled (SIMULATION_MODE=false)", 403);
  }
}

function toFrontendOrder(order: NonNullable<Awaited<ReturnType<typeof orderRepository.findById>>>) {
  return {
    id: order.id,
    marketplace: order.marketplace,
    status: order.status,
    lastStatusSource: order.lastStatusSource || undefined,
    createdAt: order.createdAt,
    packedAt: order.packedAt || undefined,
    shippedAt: order.shippedAt || undefined,
    deliveredAt: order.deliveredAt || undefined,
    items: order.items.map((item) => ({
      skuId: item.channelSku,
      skuName: item.skuName || item.channelSku,
      quantity: item.quantity,
    })),
    actions: getSimulationActions(order.status),
  };
}

export class SimulationService {
  getConfig() {
    return {
      enabled: env.simulationMode,
      shopifyCustomer: SHOPIFY_SIM_CUSTOMER,
      notes: {
        SHOPIFY: "Simulated orders always buy as the fixed Shopify customer profile.",
        FLIPKART: "Simulation creates and advances orders through the Flipkart adapter APIs.",
        AMAZON: "Seller Orders API sandbox is static — logistics advances use the internal simulator / 3PL path.",
      },
    };
  }

  async listLogisticsOrders(channelFilter?: string) {
    assertSimulationEnabled();
    const orders = await orderRepository.list();
    return orders
      .filter((o) => isLogisticsEligible(o.status))
      .filter((o) => !channelFilter || channelFilter === "ALL" || o.marketplace === channelFilter)
      .map(toFrontendOrder);
  }

  async placeOrder(body: unknown) {
    assertSimulationEnabled();
    const input = placeSchema.parse(body);
    const channel = input.channel as ChannelType;

    const config = await channelRepository.findByChannel(channel);
    if (!config || config.status !== "CONNECTED") {
      throw new AppError(`${channel} is not connected. Connect it in Settings first.`, 400);
    }

    const resolvedItems = [];
    for (const line of input.items) {
      const product = await productRepository.findById(line.productId);
      if (!product) throw new AppError(`Product not found: ${line.productId}`, 404);
      if (product.quantity < line.quantity) {
        throw new AppError(`Insufficient stock for ${product.sku} (have ${product.quantity})`, 400);
      }
      resolvedItems.push({ product, quantity: line.quantity });
    }

    const customer =
      channel === "SHOPIFY"
        ? { ...SHOPIFY_SIM_CUSTOMER }
        : {
            name: input.customer?.name?.trim() || "ERM Test Customer",
            email: input.customer?.email?.trim() || undefined,
            phone: input.customer?.phone?.trim() || undefined,
            address: input.customer?.address?.trim() || undefined,
          };

    const adapter = await channelManager.getAdapter(channel);
    if (!adapter) throw new AppError(`${channel} adapter unavailable`, 400);

    let result: CreateTestOrderResult;

    if (adapter.createTestOrder) {
      result = await adapter.createTestOrder({
        customer,
        items: resolvedItems.map(({ product, quantity }) => ({
          sku: product.sku,
          name: product.name,
          quantity,
          unitPrice: product.price,
        })),
      });
    } else {
      const adapterOrder: AdapterOrder = {
        channelOrderId: `SIM-${channel}-${Date.now()}`,
        status: "READY_TO_PACK",
        currency: "INR",
        totalAmount: resolvedItems.reduce((sum, row) => sum + row.product.price * row.quantity, 0),
        customer,
        createdAt: new Date().toISOString(),
        items: resolvedItems.map(({ product, quantity }, idx) => ({
          channelOrderItemId: `SIM-ITEM-${Date.now()}-${idx}`,
          sku: product.sku,
          name: product.name,
          quantity,
          unitPrice: product.price,
        })),
      };

      result = {
        createdOnChannel: false,
        order: adapterOrder,
        note:
          channel === "AMAZON"
            ? "Amazon Orders API sandbox is static. Created an ERM-linked Amazon order for Logistics Simulation."
            : `Created an ERM-linked ${channel} order.`,
      };
    }

    const saved = await orderService.ingestAdapterOrder(config.id, channel, result.order);

    for (const { product, quantity } of resolvedItems) {
      await inventoryService.adjust(product.id, -quantity);
    }

    return {
      order: toFrontendOrder(saved),
      createdOnChannel: result.createdOnChannel,
      note: result.note || null,
    };
  }

  async transition(orderId: string, body: unknown) {
    assertSimulationEnabled();
    const { targetStatus: rawTarget } = transitionSchema.parse(body);
    const targetStatus = toCanonicalStatus(rawTarget) as OrderStatus;

    const existing = await orderRepository.findById(orderId);
    if (!existing) throw new AppError("Order not found", 404);

    assertValidTransition(existing.status, targetStatus);

    const allowed = getSimulationActions(existing.status).map((a) => a.targetStatus);
    if (!allowed.includes(targetStatus)) {
      throw new AppError(`Action ${targetStatus} is not available from ${existing.status}`, 400);
    }

    const channel = String(existing.marketplace || "").toUpperCase() as ChannelType;
    const config = existing.channelConfigId
      ? await channelRepository.findById(existing.channelConfigId)
      : ["AMAZON", "FLIPKART", "SHOPIFY"].includes(channel)
        ? await channelRepository.findByChannel(channel)
        : null;
    const fulfillmentMethod =
      config?.fulfillmentMethod || defaultFulfillmentMethodId(channel);
    const method = getFulfillmentMethod(channel, fulfillmentMethod);
    const channelNative = isChannelNativeFulfillmentMethod(channel, fulfillmentMethod);
    const logisticsProvider = method?.requiresLogisticsProvider
      ? config?.logisticsProvider || defaultLogisticsProvider(channel)
      : null;

    // Flipkart marketplace-native: advance via Flipkart lifecycle APIs.
    if (channelNative && existing.marketplace === "FLIPKART" && existing.channelConfigId) {
      const adapter = await channelManager.getAdapter("FLIPKART");
      if (!adapter?.advanceSandboxLifecycle) {
        throw new AppError("Flipkart lifecycle API unavailable", 502);
      }
      await adapter.advanceSandboxLifecycle(existing.channelOrderId, targetStatus);
    }

    const provider = resolveLogisticsProvider(logisticsProvider);
    let advancedShipment = null as Awaited<
      ReturnType<NonNullable<typeof provider.recordSimulationAdvance>>
    > | null;
    if (!channelNative && provider.recordSimulationAdvance) {
      advancedShipment = await provider.recordSimulationAdvance(
        existing,
        targetStatus,
        logisticsProvider
      );
    }

    if (
      logisticsProvider &&
      isExternalLogisticsProvider(logisticsProvider) &&
      ["AMAZON", "FLIPKART"].includes(channel)
    ) {
      const adapter = await channelManager.getAdapter(channel);
      await notifyMarketplaceSelfShip(adapter, {
        channelOrderId: existing.channelOrderId,
        trackingNumber: advancedShipment?.trackingNumber,
        carrier: advancedShipment?.carrier || logisticsProvider,
        orderStatus: targetStatus,
      });
    }

    const order = await orderService.applyStatusChange(orderId, targetStatus, "SIMULATOR");
    const refreshed = await orderRepository.findById(orderId);
    return {
      order: refreshed ? toFrontendOrder(refreshed) : order,
      source: "SIMULATOR",
      fulfillmentMethod,
      logisticsProvider,
      logisticsMode: channelNative ? "MARKETPLACE" : provider.mode,
      previousStatus: existing.status,
      newStatus: targetStatus,
    };
  }
}

export const simulationService = new SimulationService();
