/**
 * Bridges legacy ChannelAdapter implementations into the canonical SalesChannelAdapter.
 * Existing provider folders keep working while core migrates to integrations/*.
 */
import type { ChannelAdapter } from "../../../adapters/salesChannelRegistry/types.js";
import type { SalesChannelAdapter } from "./adapter.js";
import type { ChannelCapabilities } from "./capabilities.js";
import { DEFAULT_CHANNEL_CAPABILITIES } from "./capabilities.js";
import type {
  ChannelCredentials,
  ChannelFulfillment,
  ChannelInventoryItem,
  ChannelOrder,
  ChannelProduct,
  CreateFulfillmentInput,
  InventoryQuery,
  InventoryUpdate,
  OrderQuery,
  ProductQuery,
  SalesChannelId,
  TrackingUpdate,
  UpdateFulfillmentInput,
  WebhookHandleResult,
} from "./types.js";
import { CredentialValidationError, UnsupportedCapabilityError } from "./errors.js";

export type LegacyChannelFactory = (credentials?: ChannelCredentials) => ChannelAdapter;

export class LegacySalesChannelBridge implements SalesChannelAdapter {
  readonly id: SalesChannelId;
  readonly capabilities: ChannelCapabilities;
  private inner: ChannelAdapter;
  private readonly factory: LegacyChannelFactory;

  constructor(
    id: SalesChannelId,
    factory: LegacyChannelFactory,
    capabilities: Partial<ChannelCapabilities> = {}
  ) {
    this.id = id;
    this.factory = factory;
    this.capabilities = { ...DEFAULT_CHANNEL_CAPABILITIES, ...capabilities };
    this.inner = factory({});
  }

  /** Access legacy API used by jobs/ChannelManager until fully migrated. */
  getLegacy(): ChannelAdapter {
    return this.inner;
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const status = await this.inner.getStatus();
      return Boolean(status.connected);
    } catch {
      return false;
    }
  }

  async connect(credentials: ChannelCredentials): Promise<void> {
    this.inner = this.factory(credentials);
    await this.inner.connect(credentials);
    const ok = await this.validateCredentials();
    if (!ok && Object.keys(credentials).length) {
      // Some mocks always "connect"; only fail hard when status explicitly disconnected after connect
      const status = await this.inner.getStatus();
      if (status.connected === false) {
        throw new CredentialValidationError(`${this.id} credentials were rejected`);
      }
    }
  }

  async disconnect(): Promise<void> {
    await this.inner.disconnect();
  }

  async getStatus() {
    return this.inner.getStatus();
  }

  async getProducts(_params?: ProductQuery): Promise<ChannelProduct[]> {
    const rows = await this.inner.getProducts();
    return rows.map((p) => ({
      id: p.channelProductId,
      channelProductId: p.channelProductId,
      sku: p.sku,
      name: p.name,
      description: p.description,
      price: p.price,
      quantity: p.quantity,
    }));
  }

  async getProduct(id: string): Promise<ChannelProduct | null> {
    const all = await this.getProducts();
    return all.find((p) => p.channelProductId === id || p.sku === id) || null;
  }

  async getInventory(params?: InventoryQuery): Promise<ChannelInventoryItem[]> {
    const rows = await this.inner.getInventory(params?.sku);
    return rows.map((p) => ({
      sku: p.sku,
      available: p.quantity,
      onHand: p.quantity,
      reserved: 0,
    }));
  }

  async updateInventory(items: InventoryUpdate[]): Promise<void> {
    for (const item of items) {
      await this.inner.updateInventory({ sku: item.sku, quantity: item.quantity });
    }
  }

  async getOrders(params?: OrderQuery): Promise<ChannelOrder[]> {
    const rows = await this.inner.getOrders(params?.since);
    return rows.map((o) => ({
      channelOrderId: o.channelOrderId,
      status: o.status,
      currency: o.currency,
      totalAmount: o.totalAmount,
      customer: o.customer,
      items: o.items,
      createdAt: o.createdAt,
    }));
  }

  async getOrder(id: string): Promise<ChannelOrder | null> {
    const o = await this.inner.getOrder(id);
    if (!o) return null;
    return {
      channelOrderId: o.channelOrderId,
      status: o.status,
      currency: o.currency,
      totalAmount: o.totalAmount,
      customer: o.customer,
      items: o.items,
      createdAt: o.createdAt,
    };
  }

  async createFulfillment(input: CreateFulfillmentInput): Promise<ChannelFulfillment> {
    if (!this.capabilities.fulfillment) {
      throw new UnsupportedCapabilityError("fulfillment", this.id);
    }
    const result = await this.inner.fulfillOrder({
      channelOrderId: input.channelOrderId,
      action: "CREATE_FULFILLMENT",
      trackingNumber: input.trackingNumber,
      carrier: input.carrier,
      metadata: input.metadata,
    });
    return {
      channelFulfillmentId: result.channelShipmentId,
      channelOrderId: result.channelOrderId,
      status: result.status,
      trackingNumber: result.trackingNumber || undefined,
      carrier: result.carrier || undefined,
      metadata: result.metadata,
    };
  }

  async updateFulfillment(input: UpdateFulfillmentInput): Promise<void> {
    await this.inner.fulfillOrder({
      channelOrderId: input.channelOrderId,
      action: "UPDATE_SHIPMENT",
      metadata: input.metadata,
    });
  }

  async updateTracking(input: TrackingUpdate): Promise<void> {
    if (!this.capabilities.tracking && !this.capabilities.notifySelfShip) {
      throw new UnsupportedCapabilityError("tracking", this.id);
    }
    await this.inner.fulfillOrder({
      channelOrderId: input.channelOrderId,
      action: "UPDATE_SHIPMENT",
      trackingNumber: input.trackingNumber,
      carrier: input.carrier,
      orderStatus: input.orderStatus,
      metadata: input.metadata,
    });
  }

  async handleWebhook(
    _payload: unknown,
    _headers?: Record<string, string>
  ): Promise<WebhookHandleResult> {
    if (!this.capabilities.webhooks) {
      return { accepted: false, note: "Webhooks not supported" };
    }
    // Provider-specific webhook parsing lives in each adapter; Phase 2 wires this fully.
    return { accepted: false, note: "Webhook handler not yet migrated for this channel" };
  }
}
