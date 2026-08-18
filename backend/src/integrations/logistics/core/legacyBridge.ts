/**
 * Bridges legacy logisticsRegistry adapters into the canonical LogisticsAdapter.
 */
import type { Order } from "../../../models/domain.js";
import type {
  LogisticsAdapter as LegacyLogisticsAdapter,
  LogisticsCredentials as LegacyCredentials,
} from "../../../adapters/logisticsRegistry/types.js";
import type { LogisticsAdapter } from "./adapter.js";
import type { LogisticsCapabilities } from "./capabilities.js";
import { DEFAULT_LOGISTICS_CAPABILITIES } from "./capabilities.js";
import type {
  CreateShipmentInput,
  LogisticsCredentials,
  LogisticsProviderId,
  PickupResult,
  PickupSlotOption,
  SchedulePickupInput,
  ShipmentResult,
  ShippingLabel,
  TrackingInfo,
} from "./types.js";
import { UnsupportedChannelError, UnsupportedCapabilityError } from "./errors.js";

export type LegacyLogisticsFactory = () => LegacyLogisticsAdapter;

export class LegacyLogisticsBridge implements LogisticsAdapter {
  readonly id: LogisticsProviderId;
  readonly capabilities: LogisticsCapabilities;
  private readonly factory: LegacyLogisticsFactory;
  private inner: LegacyLogisticsAdapter;
  private readonly supportedChannels: string[];

  constructor(
    id: LogisticsProviderId,
    factory: LegacyLogisticsFactory,
    options: {
      capabilities?: Partial<LogisticsCapabilities>;
      supportedChannels: string[];
    }
  ) {
    this.id = id;
    this.factory = factory;
    this.inner = factory();
    this.supportedChannels = options.supportedChannels;
    this.capabilities = {
      ...DEFAULT_LOGISTICS_CAPABILITIES,
      pickupSlots: Boolean(this.inner.getPickupSlots),
      ...options.capabilities,
      // Prefer live adapter capability flags when present
      createShipment: this.inner.capabilities?.createShipment ?? true,
      schedulePickup: this.inner.capabilities?.schedulePickup ?? true,
      generateLabel: this.inner.capabilities?.generateLabel ?? true,
      tracking: this.inner.capabilities?.tracking ?? true,
      cancelShipment: this.inner.capabilities?.cancelShipment ?? true,
    };
  }

  getLegacy(): LegacyLogisticsAdapter {
    return this.inner;
  }

  supportsChannel(salesChannelId: string): boolean {
    if (this.inner.supportsChannel) {
      return this.inner.supportsChannel(salesChannelId as never);
    }
    return this.supportedChannels.includes(salesChannelId);
  }

  async validateCredentials(): Promise<boolean> {
    return this.inner.validateCredentials();
  }

  async connect(credentials: LogisticsCredentials): Promise<void> {
    this.inner = this.factory();
    await this.inner.connect(credentials as LegacyCredentials);
  }

  async createShipment(input: CreateShipmentInput): Promise<ShipmentResult> {
    if (!this.capabilities.createShipment) {
      throw new UnsupportedCapabilityError("createShipment", this.id);
    }
    if (!this.supportsChannel(input.salesChannelId)) {
      throw new UnsupportedChannelError(this.id, input.salesChannelId);
    }

    const order = (input.orderSnapshot || {
      id: input.orderId,
      channelOrderId: input.channelOrderId || input.orderId,
      marketplace: input.salesChannelId,
    }) as unknown as Order;

    const result = await this.inner.createShipment({
      order,
      reference: input.reference,
      weightKg: input.weightKg,
      dimensionsCm: input.dimensionsCm,
      metadata: {
        ...(input.metadata || {}),
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerAddress: input.customerAddress,
      },
    });

    return {
      id: result.id,
      provider: result.carrier || this.id,
      trackingNumber: result.trackingNumber,
      labelUrl: result.labelUrl,
      status: result.status,
      metadata: result.metadata,
    };
  }

  async generateLabel(shipmentId: string): Promise<ShippingLabel> {
    if (!this.capabilities.generateLabel) {
      throw new UnsupportedCapabilityError("generateLabel", this.id);
    }
    const label = await this.inner.generateLabel(shipmentId);
    return {
      shipmentId: label.shipmentId,
      trackingNumber: label.trackingNumber,
      format: label.format,
      url: label.url,
      contentBase64: label.contentBase64,
      metadata: label.metadata,
    };
  }

  async schedulePickup(input: SchedulePickupInput): Promise<PickupResult> {
    if (!this.capabilities.schedulePickup) {
      throw new UnsupportedCapabilityError("schedulePickup", this.id);
    }
    return this.inner.schedulePickup(input);
  }

  async getPickupSlots(shipmentId: string): Promise<PickupSlotOption[]> {
    if (!this.inner.getPickupSlots) return [];
    return this.inner.getPickupSlots(shipmentId);
  }

  async getTracking(shipmentId: string): Promise<TrackingInfo | null> {
    if (!this.capabilities.tracking) {
      throw new UnsupportedCapabilityError("tracking", this.id);
    }
    const info = await this.inner.getTracking(shipmentId);
    if (!info) return null;
    return {
      trackingNumber: info.trackingNumber,
      carrier: info.carrier,
      status: info.status,
      rawStatus: info.rawStatus,
      estimatedDeliveryAt: info.estimatedDeliveryAt,
      shippedAt: info.shippedAt,
      deliveredAt: info.deliveredAt,
      events: info.events,
      metadata: info.metadata,
    };
  }

  async cancelShipment(shipmentId: string): Promise<void> {
    if (!this.capabilities.cancelShipment) {
      throw new UnsupportedCapabilityError("cancelShipment", this.id);
    }
    await this.inner.cancelShipment(shipmentId);
  }
}
