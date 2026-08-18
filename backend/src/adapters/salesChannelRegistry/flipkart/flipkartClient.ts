import { AdapterCredentials } from "../SalesChannelAdapter.js";
import { env } from "../../../config/env.js";
import { withRetry } from "../../../utils/crypto.js";
import { AppError } from "../../../middleware/errorHandler.js";

export interface FlipkartListingRaw {
  productId: string;
  sku: string;
  title: string;
  price: number;
  availableQuantity: number;
}

export interface FlipkartOrderRaw {
  orderId: string;
  orderItemId: string;
  orderState: string;
  orderDate?: string;
  priceComponents?: { sellingPrice: number };
  quantity: number;
  sku: string;
  title: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
}

export interface FlipkartShipmentRaw {
  orderId: string;
  shipmentId: string;
  status: string;
  trackingId?: string;
  courierName?: string;
}

/**
 * Shared Flipkart store used for MOCK_CHANNELS and SIMULATION_MODE.
 * Real seller API calls can replace these later while keeping the same adapter surface.
 */
const simStore = {
  products: [] as FlipkartListingRaw[],
  orders: [] as FlipkartOrderRaw[],
  shipments: new Map<string, FlipkartShipmentRaw>(),
};

export class FlipkartClient {
  constructor(private credentials: AdapterCredentials) {}

  /** Order simulation / sandbox lifecycle. */
  private useSimOrders() {
    return env.mockChannels || env.simulationMode;
  }

  /**
   * Inventory always prefers live seller APIs when an access token is present.
   * MOCK/SIMULATION still apply to order flows only.
   */
  private useSimInventory() {
    const token = String(this.credentials.accessToken || "").trim();
    if (token && token !== "mock-flipkart-token") return false;
    return this.useSimOrders();
  }

  async validateCredentials(): Promise<boolean> {
    return !!(
      this.credentials.clientId &&
      this.credentials.clientSecret &&
      this.credentials.accessToken
    );
  }

  async listListings() {
    if (!this.useSimOrders()) return [];
    return withRetry(async () => [...simStore.products]);
  }

  async listOrders(_since?: Date) {
    if (!this.useSimOrders()) return [];
    return withRetry(async () => [...simStore.orders]);
  }

  async getOrder(orderId: string) {
    if (!this.useSimOrders()) return null;
    return simStore.orders.find((o) => o.orderId === orderId) || null;
  }

  async getInventory(sku?: string) {
    if (this.useSimInventory()) {
      return simStore.products.filter((p) => !sku || p.sku === sku);
    }
    // Live listing fetch not wired yet — inventory push still updates via updateInventory.
    return [];
  }

  async updateInventory(sku: string, quantity: number) {
    await withRetry(async () => {
      if (this.useSimInventory()) {
        const p = simStore.products.find((x) => x.sku === sku);
        if (p) p.availableQuantity = quantity;
        else {
          simStore.products.push({
            productId: `FK-${sku}`,
            sku,
            title: sku,
            price: 0,
            availableQuantity: quantity,
          });
        }
        return;
      }

      const token = String(this.credentials.accessToken || "");
      const locationId = String(this.credentials.locationId || this.credentials.location_id || "").trim();
      const productId = String(this.credentials.productId || `FK-${sku}`);

      if (!token) {
        throw new AppError("Flipkart access token is required for live inventory updates", 401);
      }
      if (!locationId) {
        throw new AppError(
          "Flipkart locationId is required on the channel connection for live inventory updates",
          400
        );
      }

      const response = await fetch("https://api.flipkart.net/sellers/listings/v3/update/inventory", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          [sku]: {
            product_id: productId,
            locations: [{ id: locationId, inventory: quantity }],
          },
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new AppError(
          `Flipkart inventory update failed (${response.status}): ${text.slice(0, 240)}`,
          response.status >= 400 && response.status < 500 ? response.status : 502
        );
      }
    });
  }

  async upsertProduct(input: {
    sku: string;
    name: string;
    price: number;
    quantity: number;
    description?: string;
    imageUrl?: string | null;
  }) {
    await withRetry(async () => {
      if (this.useSimInventory()) {
        const p = simStore.products.find((x) => x.sku === input.sku);
        if (p) {
          p.title = input.name;
          p.price = input.price;
          p.availableQuantity = input.quantity;
        } else {
          simStore.products.push({
            productId: `FK-${input.sku}`,
            sku: input.sku,
            title: input.name,
            price: input.price,
            availableQuantity: input.quantity,
          });
        }
        return;
      }
      await this.updateInventory(input.sku, input.quantity);
    });
  }

  async getShipment(orderId: string) {
    if (!this.useSimOrders()) return null;
    return simStore.shipments.get(orderId) || null;
  }

  async createTestOrder(input: {
    customer: { name: string; email?: string; phone?: string; address?: string };
    items: Array<{ sku: string; name: string; quantity: number; unitPrice: number }>;
  }): Promise<{ orderId: string; orders: FlipkartOrderRaw[] }> {
    if (!this.useSimOrders()) {
      throw new AppError(
        "Flipkart create-test-order requires SIMULATION_MODE or MOCK_CHANNELS until live Seller APIs are wired",
        501
      );
    }

    return withRetry(async () => {
      const orderId = `FK-SIM-${Date.now()}`;
      const created: FlipkartOrderRaw[] = input.items.map((item, idx) => ({
        orderId,
        orderItemId: `${orderId}-ITEM-${idx + 1}`,
        orderState: "APPROVED",
        orderDate: new Date().toISOString(),
        priceComponents: { sellingPrice: item.unitPrice },
        quantity: item.quantity,
        sku: item.sku,
        title: item.name,
        customerName: input.customer.name,
        customerEmail: input.customer.email,
        customerPhone: input.customer.phone,
        customerAddress: input.customer.address,
      }));

      simStore.orders = simStore.orders.filter((o) => o.orderId !== orderId);
      simStore.orders.push(...created);
      simStore.shipments.set(orderId, {
        orderId,
        shipmentId: `FKSHIP-${orderId}`,
        status: "PENDING",
        courierName: "Ekart",
      });

      return { orderId, orders: created };
    });
  }

  async generateLabelAndInvoice(orderId: string): Promise<FlipkartShipmentRaw> {
    if (!this.useSimOrders()) {
      throw new AppError("Flipkart label API not wired for live mode yet", 501);
    }
    const shipment: FlipkartShipmentRaw = {
      orderId,
      shipmentId: `FKSHIP-${orderId}`,
      status: "PACKED",
      courierName: "Ekart",
    };
    simStore.shipments.set(orderId, shipment);
    return shipment;
  }

  async markReadyToDispatch(orderId: string): Promise<FlipkartShipmentRaw> {
    if (!this.useSimOrders()) {
      throw new AppError("Flipkart RTD API not wired for live mode yet", 501);
    }
    const existing = simStore.shipments.get(orderId) || {
      orderId,
      shipmentId: `FKSHIP-${orderId}`,
      status: "READY_TO_DISPATCH",
      courierName: "Ekart",
    };
    existing.status = "READY_TO_DISPATCH";
    existing.trackingId = `EKART-${Math.floor(Math.random() * 1e8)}`;
    simStore.shipments.set(orderId, existing);

    for (const order of simStore.orders.filter((o) => o.orderId === orderId)) {
      order.orderState = "READY_TO_DISPATCH";
    }
    return existing;
  }

  /**
   * Self-Ship: notify Flipkart of merchant/3PL dispatch status.
   * Live Seller APIs can replace this sim/stub path later.
   */
  async updateSelfShipStatus(
    orderId: string,
    input: { trackingNumber?: string; carrier?: string; orderStatus?: string }
  ): Promise<FlipkartShipmentRaw> {
    const fkState =
      input.orderStatus === "DELIVERED"
        ? "DELIVERED"
        : input.orderStatus === "DELIVERY_FAILED"
          ? "UNDELIVERED"
          : input.orderStatus === "PICKUP_SCHEDULED" ||
            input.orderStatus === "SHIPMENT_CREATED" ||
            input.orderStatus === "READY_FOR_LOGISTICS"
            ? "READY_TO_DISPATCH"
            : input.orderStatus === "PICKED_UP"
              ? "PICKUP_COMPLETE"
              : "SHIPPED";

    if (!this.useSimOrders()) {
      // Live Flipkart Self-Ship notify endpoint would be called here.
      return {
        orderId,
        shipmentId: `FKSS-${orderId}`,
        status: fkState,
        trackingId: input.trackingNumber,
        courierName: input.carrier || "Self Ship",
      };
    }

    for (const order of simStore.orders.filter((o) => o.orderId === orderId)) {
      order.orderState = fkState;
    }
    const shipment = simStore.shipments.get(orderId) || {
      orderId,
      shipmentId: `FKSS-${orderId}`,
      status: fkState,
      courierName: input.carrier || "Self Ship",
    };
    shipment.status = fkState;
    shipment.courierName = input.carrier || shipment.courierName || "Self Ship";
    shipment.trackingId = input.trackingNumber || shipment.trackingId;
    simStore.shipments.set(orderId, shipment);
    return shipment;
  }

  /**
   * Flipkart Sandbox / simulation lifecycle transitions.
   * Keeps order + shipment in sync so getShipment / syncShipments stay linked.
   */
  async advanceSandboxLifecycle(orderId: string, targetCanonical: string): Promise<string> {
    const fkState =
      targetCanonical === "PICKUP_SCHEDULED" ||
      targetCanonical === "SHIPMENT_CREATED" ||
      targetCanonical === "READY_FOR_LOGISTICS"
        ? "READY_TO_DISPATCH"
        : targetCanonical === "PICKED_UP"
          ? "PICKUP_COMPLETE"
          : targetCanonical === "IN_TRANSIT" || targetCanonical === "SHIPPED"
            ? "SHIPPED"
            : targetCanonical === "OUT_FOR_DELIVERY"
              ? "OUT_FOR_DELIVERY"
              : targetCanonical === "DELIVERED"
                ? "DELIVERED"
                : targetCanonical === "DELIVERY_FAILED"
                  ? "UNDELIVERED"
                  : targetCanonical === "RETURNED"
                    ? "RETURNED"
                    : targetCanonical;

    if (!this.useSimOrders()) {
      // Hook for live Flipkart Sandbox HTTP once credentials/endpoints are available.
      return fkState;
    }

    const linked = simStore.orders.filter((o) => o.orderId === orderId);
    if (!linked.length) {
      throw new AppError(`Flipkart order ${orderId} not found in simulation store`, 404);
    }
    for (const order of linked) {
      order.orderState = fkState;
    }

    const shipment = simStore.shipments.get(orderId) || {
      orderId,
      shipmentId: `FKSHIP-${orderId}`,
      status: fkState,
      courierName: "Ekart",
    };
    shipment.status = fkState;
    if (["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "UNDELIVERED"].includes(fkState)) {
      shipment.trackingId = shipment.trackingId || `EKART-${Math.floor(Math.random() * 1e8)}`;
    }
    simStore.shipments.set(orderId, shipment);
    return fkState;
  }

  static injectOrder(order: FlipkartOrderRaw) {
    if (!(env.mockChannels || env.simulationMode)) return;
    simStore.orders = simStore.orders.filter((o) => o.orderId !== order.orderId || o.orderItemId !== order.orderItemId);
    simStore.orders.push(order);
  }
}
