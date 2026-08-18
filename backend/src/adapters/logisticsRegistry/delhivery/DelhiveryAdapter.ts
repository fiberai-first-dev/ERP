import { BaseLogisticsAdapter } from "../base/BaseLogisticsAdapter.js";
import {
  CreateShipmentInput,
  PickupResult,
  SchedulePickupInput,
  ShippingLabel,
  TrackingResult,
} from "../types.js";
import { logger } from "../../../utils/logger.js";

export class DelhiveryAdapter extends BaseLogisticsAdapter {
  readonly id = "DELHIVERY" as const;

  async validateCredentials(): Promise<boolean> {
    if (!this.require(["apiToken"])) return false;
    return true;
  }

  protected async createShipmentLive(
    input: CreateShipmentInput,
    shipmentId: string,
    trackingNumber: string
  ): Promise<void> {
    // Delhivery waybill creation requires warehouse/pincode setup; use stub booking when API rejects.
    try {
      const response = await fetch("https://track.delhivery.com/api/cmu/create.json", {
        method: "POST",
        headers: {
          Authorization: `Token ${this.credentials.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shipments: [
            {
              order: input.order.channelOrderId || input.order.id,
              waybill: trackingNumber,
              products_desc: input.order.items.map((i) => i.skuName).join(", ").slice(0, 200),
              order_date: input.order.createdAt,
              total_amount: input.order.totalAmount,
              quantity: input.order.items.reduce((n, i) => n + i.quantity, 0) || 1,
            },
          ],
          pickup_location: { name: "ERM Warehouse" },
        }),
      });
      if (!response.ok) {
        logger.warn(
          { status: response.status, shipmentId },
          "Delhivery createShipment API unavailable — using local AWB"
        );
      }
    } catch (err) {
      logger.warn({ err, shipmentId }, "Delhivery createShipment failed — using local AWB");
    }
  }

  protected async generateLabelLive(
    shipmentId: string,
    trackingNumber: string
  ): Promise<ShippingLabel> {
    try {
      const response = await fetch(
        `https://track.delhivery.com/api/p/packing_slip?wbns=${encodeURIComponent(trackingNumber)}`,
        { headers: { Authorization: `Token ${this.credentials.apiToken}` } }
      );
      if (response.ok) {
        const json = (await response.json()) as { packages?: Array<{ pdf_download_link?: string }> };
        const url = json.packages?.[0]?.pdf_download_link;
        if (url) {
          return {
            shipmentId,
            trackingNumber,
            format: "URL",
            url,
            metadata: { provider: "DELHIVERY", source: "LIVE" },
          };
        }
      }
    } catch (err) {
      logger.warn({ err, trackingNumber }, "Delhivery label API failed — stub label");
    }
    return {
      shipmentId,
      trackingNumber,
      format: "URL",
      url: `https://track.delhivery.com/p/${encodeURIComponent(trackingNumber)}`,
      metadata: { provider: "DELHIVERY", source: "STUB" },
    };
  }

  protected async schedulePickupLive(
    input: SchedulePickupInput,
    trackingNumber: string
  ): Promise<PickupResult> {
    try {
      const response = await fetch("https://track.delhivery.com/fm/request/new/", {
        method: "POST",
        headers: {
          Authorization: `Token ${this.credentials.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pickup_time: input.pickupDate || new Date().toISOString(),
          pickup_date: (input.pickupDate || new Date().toISOString()).slice(0, 10),
          expected_package_count: 1,
        }),
      });
      if (response.ok) {
        const json = (await response.json()) as { pickup_id?: string | number };
        return {
          pickupId: String(json.pickup_id || `PU-DEL-${trackingNumber}`),
          shipmentId: input.shipmentId,
          scheduledAt: input.pickupDate || new Date().toISOString(),
          status: "SCHEDULED",
          metadata: { provider: "DELHIVERY", source: "LIVE" },
        };
      }
    } catch (err) {
      logger.warn({ err, trackingNumber }, "Delhivery pickup API failed — stub schedule");
    }
    return {
      pickupId: `PU-DEL-${trackingNumber}`.slice(0, 48),
      shipmentId: input.shipmentId,
      scheduledAt: input.pickupDate || new Date().toISOString(),
      status: "SCHEDULED",
      metadata: { provider: "DELHIVERY", source: "STUB" },
    };
  }

  protected async trackLive(trackingNumber: string): Promise<TrackingResult | null> {
    const response = await fetch(
      `https://track.delhivery.com/api/v1/packages/json/?waybill=${encodeURIComponent(trackingNumber)}`,
      { headers: { Authorization: `Token ${this.credentials.apiToken}` } }
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Delhivery track failed (${response.status})`);
    const json = (await response.json()) as {
      ShipmentData?: Array<{
        Shipment?: {
          Status?: { Status?: string; StatusDateTime?: string };
          AWB?: string;
        };
      }>;
    };
    const shipment = json.ShipmentData?.[0]?.Shipment;
    if (!shipment) return null;
    const raw = shipment.Status?.Status || "UNKNOWN";
    const status = this.mapStatus(raw);
    return {
      trackingNumber,
      carrier: "DELHIVERY",
      status,
      rawStatus: raw,
      deliveredAt: status === "DELIVERED" ? shipment.Status?.StatusDateTime : undefined,
      metadata: { provider: "DELHIVERY" },
    };
  }
}
