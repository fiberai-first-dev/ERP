import { BaseLogisticsAdapter } from "../base/BaseLogisticsAdapter.js";
import {
  CreateShipmentInput,
  PickupResult,
  SchedulePickupInput,
  ShippingLabel,
  TrackingResult,
} from "../types.js";
import { logger } from "../../../utils/logger.js";

export class ShiprocketAdapter extends BaseLogisticsAdapter {
  readonly id = "SHIPROCKET" as const;
  private token: string | null = null;

  async validateCredentials(): Promise<boolean> {
    if (!this.require(["email", "password"])) return false;
    if (this.useSimApis()) return true;
    try {
      await this.authenticate();
      return true;
    } catch {
      return false;
    }
  }

  private async authenticate() {
    const response = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: this.credentials.email,
        password: this.credentials.password,
      }),
    });
    if (!response.ok) throw new Error(`Shiprocket auth failed (${response.status})`);
    const json = (await response.json()) as { token?: string };
    if (!json.token) throw new Error("Shiprocket token missing");
    this.token = json.token;
    return json.token;
  }

  private async authHeader() {
    const token = this.token || (await this.authenticate());
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  protected async createShipmentLive(
    input: CreateShipmentInput,
    shipmentId: string,
    trackingNumber: string
  ): Promise<void> {
    try {
      const headers = await this.authHeader();
      const response = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
        method: "POST",
        headers,
        body: JSON.stringify({
          order_id: input.order.channelOrderId || input.order.id,
          order_date: (input.order.createdAt || new Date().toISOString()).slice(0, 10),
          billing_customer_name: "Customer",
          billing_address: "Address on file",
          billing_city: "Bengaluru",
          billing_pincode: "560001",
          billing_state: "Karnataka",
          billing_country: "India",
          billing_email: "orders@example.com",
          billing_phone: "9999999999",
          shipping_is_billing: true,
          order_items: input.order.items.map((item) => ({
            name: item.skuName || item.channelSku,
            sku: item.channelSku,
            units: item.quantity,
            selling_price: item.unitPrice,
          })),
          payment_method: "Prepaid",
          sub_total: input.order.totalAmount,
          length: input.dimensionsCm?.length || 10,
          breadth: input.dimensionsCm?.width || 10,
          height: input.dimensionsCm?.height || 10,
          weight: input.weightKg || 0.5,
        }),
      });
      if (!response.ok) {
        logger.warn(
          { status: response.status, shipmentId, trackingNumber },
          "Shiprocket createShipment unavailable — using local AWB"
        );
      }
    } catch (err) {
      logger.warn({ err, shipmentId }, "Shiprocket createShipment failed — using local AWB");
    }
  }

  protected async generateLabelLive(
    shipmentId: string,
    trackingNumber: string
  ): Promise<ShippingLabel> {
    try {
      const headers = await this.authHeader();
      const response = await fetch("https://apiv2.shiprocket.in/v1/external/courier/generate/label", {
        method: "POST",
        headers,
        body: JSON.stringify({ shipment_id: [shipmentId] }),
      });
      if (response.ok) {
        const json = (await response.json()) as { label_url?: string };
        if (json.label_url) {
          return {
            shipmentId,
            trackingNumber,
            format: "URL",
            url: json.label_url,
            metadata: { provider: "SHIPROCKET", source: "LIVE" },
          };
        }
      }
    } catch (err) {
      logger.warn({ err, trackingNumber }, "Shiprocket label API failed — stub label");
    }
    return {
      shipmentId,
      trackingNumber,
      format: "URL",
      url: `https://shiprocket.co/tracking/${encodeURIComponent(trackingNumber)}`,
      metadata: { provider: "SHIPROCKET", source: "STUB" },
    };
  }

  protected async schedulePickupLive(
    input: SchedulePickupInput,
    trackingNumber: string
  ): Promise<PickupResult> {
    try {
      const headers = await this.authHeader();
      const response = await fetch("https://apiv2.shiprocket.in/v1/external/courier/generate/pickup", {
        method: "POST",
        headers,
        body: JSON.stringify({ shipment_id: [input.shipmentId] }),
      });
      if (response.ok) {
        const json = (await response.json()) as { pickup_status?: number; response?: { pickup_token_number?: string } };
        return {
          pickupId: String(json.response?.pickup_token_number || `PU-SR-${trackingNumber}`),
          shipmentId: input.shipmentId,
          scheduledAt: input.pickupDate || new Date().toISOString(),
          status: "SCHEDULED",
          metadata: { provider: "SHIPROCKET", source: "LIVE", pickup_status: json.pickup_status },
        };
      }
    } catch (err) {
      logger.warn({ err, trackingNumber }, "Shiprocket pickup API failed — stub schedule");
    }
    return {
      pickupId: `PU-SR-${trackingNumber}`.slice(0, 48),
      shipmentId: input.shipmentId,
      scheduledAt: input.pickupDate || new Date().toISOString(),
      status: "SCHEDULED",
      metadata: { provider: "SHIPROCKET", source: "STUB" },
    };
  }

  protected async trackLive(trackingNumber: string): Promise<TrackingResult | null> {
    const token = this.token || (await this.authenticate());
    const response = await fetch(
      `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${encodeURIComponent(trackingNumber)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Shiprocket track failed (${response.status})`);
    const json = (await response.json()) as {
      tracking_data?: {
        track_status?: number;
        shipment_status?: string;
        shipment_track?: Array<{
          current_status?: string;
          awb_code?: string;
          edd?: string;
        }>;
      };
    };
    const track = json.tracking_data?.shipment_track?.[0];
    const raw = track?.current_status || json.tracking_data?.shipment_status || "UNKNOWN";
    return {
      trackingNumber,
      carrier: "SHIPROCKET",
      status: this.mapStatus(raw),
      rawStatus: raw,
      estimatedDeliveryAt: track?.edd,
      metadata: { provider: "SHIPROCKET", payload: json.tracking_data },
    };
  }
}
