import {
  AdapterCredentials,
  AdapterOrder,
  AdapterProduct,
  AdapterShipment,
  ChannelAdapter,
  CreateTestOrderInput,
  CreateTestOrderResult,
  FulfillOrderInput,
  InventoryUpdateInput,
  ProductSyncInput,
} from "../SalesChannelAdapter.js";
import { FlipkartClient } from "./flipkartClient.js";
import { mapFlipkartOrder, mapFlipkartProduct, mapFlipkartShipment } from "./flipkartMapper.js";
import { AppError } from "../../../middleware/errorHandler.js";
import { OrderStatus } from "../../../models/domain.js";
import { env } from "../../../config/env.js";
import { FLIPKART_FULFILLMENT_METHODS } from "../fulfillmentMethods.js";
import type { FulfillmentMethodDefinition } from "../fulfillmentMethods.js";

export class FlipkartAdapter implements ChannelAdapter {
  readonly channel = "FLIPKART" as const;
  private client: FlipkartClient | null = null;

  constructor(private credentials: AdapterCredentials = {}) {
    if (Object.keys(credentials).length) this.client = new FlipkartClient(credentials);
  }

  getFulfillmentMethods(): FulfillmentMethodDefinition[] {
    return FLIPKART_FULFILLMENT_METHODS;
  }

  private requireClient() {
    if (!this.client) throw new AppError("Flipkart adapter is not connected", 400);
    return this.client;
  }

  async connect(credentials: AdapterCredentials): Promise<void> {
    this.credentials = credentials;
    this.client = new FlipkartClient(credentials);
    if (!(await this.client.validateCredentials())) {
      throw new AppError("Invalid Flipkart credentials", 401);
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.credentials = {};
  }

  async getStatus() {
    if (!this.client) return { connected: false };
    const ok = await this.client.validateCredentials();
    return { connected: ok, details: ok ? "Flipkart ready" : "Auth failed" };
  }

  async getProducts(): Promise<AdapterProduct[]> {
    return (await this.requireClient().listListings()).map(mapFlipkartProduct);
  }

  async getOrders(since?: Date): Promise<AdapterOrder[]> {
    const rows = await this.requireClient().listOrders(since);
    const byOrder = new Map<string, AdapterOrder>();
    for (const raw of rows) {
      const mapped = mapFlipkartOrder(raw);
      const existing = byOrder.get(mapped.channelOrderId);
      if (!existing) {
        byOrder.set(mapped.channelOrderId, mapped);
      } else {
        existing.items.push(...mapped.items);
        existing.totalAmount += mapped.totalAmount;
      }
    }
    return [...byOrder.values()];
  }

  async getOrder(channelOrderId: string): Promise<AdapterOrder | null> {
    const rows = (await this.requireClient().listOrders()).filter((o) => o.orderId === channelOrderId);
    if (!rows.length) return null;
    const base = mapFlipkartOrder(rows[0]);
    for (const raw of rows.slice(1)) {
      const mapped = mapFlipkartOrder(raw);
      base.items.push(...mapped.items);
      base.totalAmount += mapped.totalAmount;
    }
    return base;
  }

  async getInventory(sku?: string): Promise<AdapterProduct[]> {
    return (await this.requireClient().getInventory(sku)).map(mapFlipkartProduct);
  }

  async updateInventory(input: InventoryUpdateInput): Promise<void> {
    await this.requireClient().updateInventory(input.sku, input.quantity);
  }

  async upsertProduct(input: ProductSyncInput): Promise<void> {
    await this.requireClient().upsertProduct(input);
  }

  async getShipment(channelOrderId: string): Promise<AdapterShipment | null> {
    const shipment = await this.requireClient().getShipment(channelOrderId);
    return shipment ? mapFlipkartShipment(shipment) : null;
  }

  async fulfillOrder(input: FulfillOrderInput): Promise<AdapterShipment> {
    const client = this.requireClient();
    if (input.action === "PACK") {
      return mapFlipkartShipment(await client.generateLabelAndInvoice(input.channelOrderId));
    }
    if (input.action === "MARK_READY") {
      return mapFlipkartShipment(await client.markReadyToDispatch(input.channelOrderId));
    }
    if (input.action === "UPDATE_SHIPMENT") {
      return mapFlipkartShipment(
        await client.updateSelfShipStatus(input.channelOrderId, {
          trackingNumber: input.trackingNumber,
          carrier: input.carrier,
          orderStatus: input.orderStatus,
        })
      );
    }
    throw new AppError(`Unsupported Flipkart fulfill action: ${input.action}`, 400);
  }

  async createTestOrder(input: CreateTestOrderInput): Promise<CreateTestOrderResult> {
    const client = this.requireClient();
    const { orderId, orders } = await client.createTestOrder(input);
    const aggregate = mapFlipkartOrder(orders[0]);
    for (const raw of orders.slice(1)) {
      const mapped = mapFlipkartOrder(raw);
      aggregate.items.push(...mapped.items);
      aggregate.totalAmount += mapped.totalAmount;
    }
    aggregate.customer = {
      name: input.customer.name,
      email: input.customer.email,
      phone: input.customer.phone,
      address: input.customer.address,
    };
    aggregate.channelOrderId = orderId;
    aggregate.status = "READY_TO_PACK";

    return {
      createdOnChannel: env.mockChannels || env.simulationMode,
      order: aggregate,
      note: "Created Flipkart simulation order via Flipkart adapter APIs.",
    };
  }

  async advanceSandboxLifecycle(channelOrderId: string, targetCanonicalStatus: OrderStatus) {
    return this.requireClient().advanceSandboxLifecycle(channelOrderId, targetCanonicalStatus);
  }
}
