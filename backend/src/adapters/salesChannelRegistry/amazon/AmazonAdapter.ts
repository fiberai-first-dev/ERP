import {
  AdapterCredentials,
  AdapterOrder,
  AdapterProduct,
  AdapterShipment,
  ChannelAdapter,
  FulfillOrderInput,
  InventoryUpdateInput,
  PickupSlot,
  ProductSyncInput,
} from "../SalesChannelAdapter.js";
import { AmazonClient } from "./amazonClient.js";
import { mapAmazonOrder, mapAmazonProduct, mapAmazonShipment } from "./amazonMapper.js";
import { AppError } from "../../../middleware/errorHandler.js";
import { AMAZON_FULFILLMENT_METHODS } from "../fulfillmentMethods.js";
import type { FulfillmentMethodDefinition } from "../fulfillmentMethods.js";

export class AmazonAdapter implements ChannelAdapter {
  readonly channel = "AMAZON" as const;
  private client: AmazonClient | null = null;

  constructor(private credentials: AdapterCredentials = {}) {
    if (Object.keys(credentials).length) {
      this.client = new AmazonClient(credentials);
    }
  }

  getFulfillmentMethods(): FulfillmentMethodDefinition[] {
    return AMAZON_FULFILLMENT_METHODS;
  }

  private requireClient() {
    if (!this.client) throw new AppError("Amazon adapter is not connected", 400);
    return this.client;
  }

  async connect(credentials: AdapterCredentials): Promise<void> {
    this.credentials = credentials;
    this.client = new AmazonClient(credentials);
    const ok = await this.client.validateCredentials();
    if (!ok) throw new AppError("Invalid Amazon credentials", 401);
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.credentials = {};
  }

  async getStatus() {
    if (!this.client) return { connected: false };
    const ok = await this.client.validateCredentials();
    return { connected: ok, details: ok ? "Amazon ready" : "Auth failed" };
  }

  async getProducts(): Promise<AdapterProduct[]> {
    const listings = await this.requireClient().listListings();
    return listings.map(mapAmazonProduct);
  }

  async getOrders(since?: Date): Promise<AdapterOrder[]> {
    const orders = await this.requireClient().listOrders(since);
    return orders.map(mapAmazonOrder);
  }

  async getOrder(channelOrderId: string): Promise<AdapterOrder | null> {
    const order = await this.requireClient().getOrder(channelOrderId);
    return order ? mapAmazonOrder(order) : null;
  }

  async getInventory(sku?: string): Promise<AdapterProduct[]> {
    const inventory = await this.requireClient().getInventory(sku);
    return inventory.map(mapAmazonProduct);
  }

  async updateInventory(input: InventoryUpdateInput): Promise<void> {
    await this.requireClient().updateInventory(input.sku, input.quantity);
  }

  async upsertProduct(input: ProductSyncInput): Promise<void> {
    await this.requireClient().upsertProduct(input);
  }

  async getShipment(channelOrderId: string): Promise<AdapterShipment | null> {
    const shipment = await this.requireClient().getEasyShipShipment(channelOrderId);
    return shipment ? mapAmazonShipment(shipment) : null;
  }

  async getPickupSlots(channelOrderId: string): Promise<PickupSlot[]> {
    return this.requireClient().getPickupSlots(channelOrderId);
  }

  async fulfillOrder(input: FulfillOrderInput): Promise<AdapterShipment> {
    const client = this.requireClient();
    if (input.action === "SCHEDULE_PICKUP") {
      if (!input.pickupSlotId) throw new AppError("pickupSlotId required for Amazon pickup", 400);
      const shipment = await client.scheduleEasyShip(input.channelOrderId, input.pickupSlotId);
      return mapAmazonShipment(shipment);
    }
    if (input.action === "PACK") {
      const shipment = await client.markPacked(input.channelOrderId);
      return mapAmazonShipment(shipment);
    }
    if (input.action === "UPDATE_SHIPMENT") {
      const shipment = await client.updateSelfShipStatus(input.channelOrderId, {
        trackingNumber: input.trackingNumber,
        carrier: input.carrier,
        orderStatus: input.orderStatus,
      });
      return mapAmazonShipment(shipment);
    }
    throw new AppError(`Unsupported Amazon fulfill action: ${input.action}`, 400);
  }
}
