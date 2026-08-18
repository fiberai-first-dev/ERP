import { env } from "../../../config/env.js";
import { AppError } from "../../../middleware/errorHandler.js";
import { ChannelType, ShipmentStatus } from "../../../models/domain.js";
import {
  ALL_SALES_CHANNELS,
  CreateShipmentInput,
  DEFAULT_EXTERNAL_CAPABILITIES,
  LogisticsAdapter,
  LogisticsCapabilities,
  LogisticsCredentials,
  LogisticsServiceId,
  PickupResult,
  PickupSlotOption,
  SchedulePickupInput,
  ShipmentResult,
  ShippingLabel,
  TrackingInfo,
  TrackingResult,
  logisticsSupportsChannel,
  mapCourierStatus,
} from "../types.js";
import { getLogisticsServiceMeta } from "../catalog.js";
import { writeSimLabelPdf } from "./simLabel.js";

type SimShipment = {
  trackingNumber: string;
  shipmentId: string;
  status: ShipmentStatus;
  rawStatus: string;
  orderId?: string;
  channelOrderId?: string;
  marketplace?: string;
  customerName?: string;
  labelUrl?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelled?: boolean;
  pickupId?: string;
  pickupScheduledAt?: string;
  pickupSlotId?: string;
};

const simShipments = new Map<string, SimShipment>();
const shipmentIndex = new Map<string, { partner: LogisticsServiceId; trackingNumber: string }>();

function simKey(partner: LogisticsServiceId, trackingNumber: string) {
  return `${partner}:${trackingNumber}`;
}

/** Shared base for all external logistics adapters. */
export abstract class BaseLogisticsAdapter implements LogisticsAdapter {
  abstract readonly id: LogisticsServiceId;
  protected credentials: LogisticsCredentials = {};

  get capabilities(): LogisticsCapabilities {
    try {
      return getLogisticsServiceMeta(this.id).capabilities;
    } catch {
      return DEFAULT_EXTERNAL_CAPABILITIES;
    }
  }

  supportsChannel(channel: ChannelType): boolean {
    try {
      return logisticsSupportsChannel(getLogisticsServiceMeta(this.id), channel);
    } catch {
      return ALL_SALES_CHANNELS.includes(channel);
    }
  }

  protected useSimApis() {
    return env.mockChannels || env.simulationMode;
  }

  protected assertSupportsOrderChannel(input: CreateShipmentInput) {
    const raw = String(input.order.marketplace || "").toUpperCase();
    if (!(ALL_SALES_CHANNELS as string[]).includes(raw)) return;
    const channel = raw as ChannelType;
    if (!this.supportsChannel(channel)) {
      throw new AppError(
        `${this.id} does not support shipments for sales channel ${channel}`,
        400
      );
    }
  }

  async connect(credentials: LogisticsCredentials): Promise<void> {
    this.credentials = credentials;
    if (this.useSimApis()) return;
    if (!(await this.validateCredentials())) {
      throw new AppError(`Invalid ${this.id} logistics credentials`, 401);
    }
  }

  async validate(): Promise<boolean> {
    return this.validateCredentials();
  }

  abstract validateCredentials(): Promise<boolean>;

  protected abstract trackLive(trackingNumber: string): Promise<TrackingResult | null>;

  protected makeAwb(orderId: string) {
    const prefix = this.id.slice(0, 3).toUpperCase();
    const stamp = Date.now().toString(36).toUpperCase();
    return `${prefix}${stamp}${orderId.replace(/[^A-Za-z0-9]/g, "").slice(-6)}`.slice(0, 24);
  }

  protected registerShipment(shipmentId: string, trackingNumber: string) {
    shipmentIndex.set(shipmentId, { partner: this.id, trackingNumber });
  }

  protected resolveTrackingNumber(shipmentId: string): string | null {
    const hit = shipmentIndex.get(shipmentId);
    if (hit && hit.partner === this.id) return hit.trackingNumber;
    return shipmentId.trim() || null;
  }

  async createShipment(input: CreateShipmentInput): Promise<ShipmentResult> {
    this.assertSupportsOrderChannel(input);
    const trackingNumber = input.reference?.trim() || this.makeAwb(input.order.id);
    const shipmentId = `${this.id}-${trackingNumber}`;
    this.registerShipment(shipmentId, trackingNumber);
    const customerName =
      typeof input.metadata?.customerName === "string" ? input.metadata.customerName : undefined;

    if (this.useSimApis()) {
      simShipments.set(simKey(this.id, trackingNumber), {
        trackingNumber,
        shipmentId,
        status: "LABEL_CREATED",
        rawStatus: "CREATED",
        orderId: input.order.id,
        channelOrderId: input.order.channelOrderId,
        marketplace: String(input.order.marketplace || ""),
        customerName,
      });
    } else {
      await this.createShipmentLive?.(input, shipmentId, trackingNumber);
      // Keep sim mirror for label/slot fallback when live APIs are unavailable.
      simShipments.set(simKey(this.id, trackingNumber), {
        trackingNumber,
        shipmentId,
        status: "LABEL_CREATED",
        rawStatus: "CREATED",
        orderId: input.order.id,
        channelOrderId: input.order.channelOrderId,
        marketplace: String(input.order.marketplace || ""),
        customerName,
      });
    }

    return {
      id: shipmentId,
      trackingNumber,
      carrier: this.id,
      status: "LABEL_CREATED",
      metadata: {
        provider: this.id,
        source: this.useSimApis() ? "SIM" : "LIVE",
        orderId: input.order.id,
      },
    };
  }

  protected async createShipmentLive(
    _input: CreateShipmentInput,
    _shipmentId: string,
    _trackingNumber: string
  ): Promise<void> {}

  protected generateSimLabel(shipmentId: string, trackingNumber: string): ShippingLabel {
    const existing = simShipments.get(simKey(this.id, trackingNumber));
    const written = writeSimLabelPdf({
      carrier: this.id,
      awb: trackingNumber,
      orderId: existing?.orderId || shipmentId,
      marketplace: existing?.marketplace,
      customerName: existing?.customerName,
    });
    if (existing) {
      existing.labelUrl = written.relativeUrl;
      existing.status = "LABEL_CREATED";
      existing.rawStatus = "LABEL_GENERATED";
      simShipments.set(simKey(this.id, trackingNumber), existing);
    }
    return {
      shipmentId,
      trackingNumber,
      format: "PDF",
      url: written.relativeUrl,
      contentBase64: written.base64,
      metadata: {
        provider: this.id,
        source: this.useSimApis() ? "SIM" : "STUB",
        contentType: "application/pdf",
      },
    };
  }

  async generateLabel(shipmentId: string): Promise<ShippingLabel> {
    const trackingNumber = this.resolveTrackingNumber(shipmentId) || shipmentId;
    if (!this.useSimApis() && this.generateLabelLive) {
      try {
        return await this.generateLabelLive(shipmentId, trackingNumber);
      } catch {
        return this.generateSimLabel(shipmentId, trackingNumber);
      }
    }
    return this.generateSimLabel(shipmentId, trackingNumber);
  }

  protected generateLabelLive?(
    shipmentId: string,
    trackingNumber: string
  ): Promise<ShippingLabel>;

  async schedulePickup(input: SchedulePickupInput): Promise<PickupResult> {
    const trackingNumber =
      input.trackingNumber || this.resolveTrackingNumber(input.shipmentId) || input.shipmentId;

    if (!this.useSimApis() && this.schedulePickupLive) {
      return this.schedulePickupLive(input, trackingNumber);
    }

    let scheduledAt = input.pickupDate || new Date().toISOString();
    if (input.pickupSlotId) {
      const slots = await this.getPickupSlots(input.shipmentId);
      const match = slots.find((s) => s.id === input.pickupSlotId);
      if (match?.startsAt) scheduledAt = match.startsAt;
    }

    const pickupId = `PU-${this.id}-${trackingNumber}`.slice(0, 48);
    const existing = simShipments.get(simKey(this.id, trackingNumber));
    if (existing) {
      existing.status = "READY_FOR_PICKUP";
      existing.rawStatus = "PICKUP_SCHEDULED";
      existing.pickupId = pickupId;
      existing.pickupScheduledAt = scheduledAt;
      existing.pickupSlotId = input.pickupSlotId;
      simShipments.set(simKey(this.id, trackingNumber), existing);
    } else {
      simShipments.set(simKey(this.id, trackingNumber), {
        trackingNumber,
        shipmentId: input.shipmentId,
        status: "READY_FOR_PICKUP",
        rawStatus: "PICKUP_SCHEDULED",
        pickupId,
        pickupScheduledAt: scheduledAt,
        pickupSlotId: input.pickupSlotId,
      });
    }

    return {
      pickupId,
      shipmentId: input.shipmentId,
      scheduledAt,
      status: "SCHEDULED",
      metadata: {
        provider: this.id,
        source: this.useSimApis() ? "SIM" : "STUB",
        trackingNumber,
        pickupSlotId: input.pickupSlotId,
      },
    };
  }

  protected schedulePickupLive?(
    input: SchedulePickupInput,
    trackingNumber: string
  ): Promise<PickupResult>;

  protected generateSimPickupSlots(_trackingNumber: string): PickupSlotOption[] {
    const slots: PickupSlotOption[] = [];
    const now = new Date();
    for (let day = 1; day <= 3; day++) {
      for (const [hour, label] of [
        [10, "Morning"],
        [14, "Afternoon"],
        [18, "Evening"],
      ] as const) {
        const start = new Date(now);
        start.setDate(now.getDate() + day);
        start.setHours(hour, 0, 0, 0);
        const end = new Date(start);
        end.setHours(hour + 3, 0, 0, 0);
        const id = `${this.id}-${start.toISOString()}`;
        slots.push({
          id,
          label: `${label} · ${start.toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })} ${String(hour).padStart(2, "0")}:00–${String(hour + 3).padStart(2, "0")}:00`,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          metadata: { provider: this.id, source: "SIM" },
        });
      }
    }
    return slots;
  }

  async getPickupSlots(shipmentId: string): Promise<PickupSlotOption[]> {
    const trackingNumber = this.resolveTrackingNumber(shipmentId) || shipmentId;
    if (!this.useSimApis() && this.getPickupSlotsLive) {
      try {
        const live = await this.getPickupSlotsLive(shipmentId, trackingNumber);
        if (live.length) return live;
      } catch {
        // fall through to sim slots
      }
    }
    return this.generateSimPickupSlots(trackingNumber);
  }

  protected getPickupSlotsLive?(
    shipmentId: string,
    trackingNumber: string
  ): Promise<PickupSlotOption[]>;

  /** Expose sim row for marketplace adapters that need channelOrderId. */
  protected getSimShipment(trackingNumber: string): SimShipment | undefined {
    return simShipments.get(simKey(this.id, trackingNumber));
  }

  async getTracking(shipmentId: string): Promise<TrackingInfo | null> {
    const trackingNumber = this.resolveTrackingNumber(shipmentId);
    if (!trackingNumber) return null;
    return this.track(trackingNumber);
  }

  async cancelShipment(shipmentId: string): Promise<void> {
    const trackingNumber = this.resolveTrackingNumber(shipmentId) || shipmentId;
    if (this.useSimApis() || !this.cancelShipmentLive) {
      const key = simKey(this.id, trackingNumber);
      const existing = simShipments.get(key);
      if (existing) {
        existing.status = "CANCELLED";
        existing.rawStatus = "CANCELLED";
        existing.cancelled = true;
        simShipments.set(key, existing);
      }
      return;
    }
    await this.cancelShipmentLive(shipmentId, trackingNumber);
  }

  protected cancelShipmentLive?(shipmentId: string, trackingNumber: string): Promise<void>;

  async track(trackingNumber: string): Promise<TrackingResult | null> {
    const awb = trackingNumber.trim();
    if (!awb) return null;

    if (this.useSimApis()) {
      const existing = simShipments.get(simKey(this.id, awb));
      if (!existing) {
        return {
          trackingNumber: awb,
          carrier: this.id,
          status: "PENDING",
          rawStatus: "PENDING",
          metadata: { source: "SIM" },
        };
      }
      return {
        trackingNumber: awb,
        carrier: this.id,
        status: existing.status,
        rawStatus: existing.rawStatus,
        shippedAt: existing.shippedAt,
        deliveredAt: existing.deliveredAt,
        events: [
          {
            status: existing.rawStatus,
            description: `${this.id} · ${existing.status}`,
            occurredAt: existing.shippedAt || existing.pickupScheduledAt || new Date().toISOString(),
          },
        ],
        metadata: {
          source: "SIM",
          shipmentId: existing.shipmentId,
          labelUrl: existing.labelUrl,
          pickupId: existing.pickupId,
          orderId: existing.orderId,
        },
      };
    }

    return this.trackLive(awb);
  }

  async simulateAdvance(trackingNumber: string, status: ShipmentStatus): Promise<TrackingResult> {
    const awb = trackingNumber.trim();
    const now = new Date().toISOString();
    const existing = simShipments.get(simKey(this.id, awb));
    const row: SimShipment = {
      trackingNumber: awb,
      shipmentId: existing?.shipmentId || `${this.id}-${awb}`,
      status,
      rawStatus: status,
      shippedAt:
        status === "IN_TRANSIT" || status === "DELIVERED" || status === "RTO" || status === "PICKED_UP"
          ? now
          : undefined,
      deliveredAt: status === "DELIVERED" || status === "RTO" ? now : undefined,
    };
    simShipments.set(simKey(this.id, awb), row);
    this.registerShipment(row.shipmentId, awb);
    return {
      trackingNumber: awb,
      carrier: this.id,
      status: row.status,
      rawStatus: row.rawStatus,
      shippedAt: row.shippedAt,
      deliveredAt: row.deliveredAt,
      metadata: { source: "SIMULATOR" },
    };
  }

  protected require(keys: string[]) {
    for (const key of keys) {
      if (!this.credentials[key]?.trim()) return false;
    }
    return true;
  }

  protected mapStatus(raw: string) {
    return mapCourierStatus(raw);
  }
}

/** @deprecated use BaseLogisticsAdapter */
export { BaseLogisticsAdapter as BaseLogisticsPartnerAdapter };
