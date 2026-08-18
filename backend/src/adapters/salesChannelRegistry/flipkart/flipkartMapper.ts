import { AdapterOrder, AdapterProduct, AdapterShipment } from "../SalesChannelAdapter.js";
import { ShipmentStatus } from "../../../models/domain.js";
import { FlipkartListingRaw, FlipkartOrderRaw, FlipkartShipmentRaw } from "./flipkartClient.js";
import { toCanonicalStatus } from "../../../services/orderLifecycle.js";

function mapShipmentStatus(status: string): ShipmentStatus {
  const s = status.toUpperCase();
  if (s.includes("DELIVER")) return "DELIVERED";
  if (s.includes("RTO")) return "RTO";
  if (s.includes("SHIP") || s.includes("TRANSIT")) return "IN_TRANSIT";
  if (s.includes("READY")) return "READY_FOR_PICKUP";
  if (s.includes("PACK") || s.includes("LABEL")) return "LABEL_CREATED";
  return "PENDING";
}

export function mapFlipkartProduct(raw: FlipkartListingRaw): AdapterProduct {
  return {
    channelProductId: raw.productId,
    sku: raw.sku,
    name: raw.title,
    price: raw.price,
    quantity: raw.availableQuantity,
  };
}

export function mapFlipkartOrder(raw: FlipkartOrderRaw): AdapterOrder {
  return {
    channelOrderId: raw.orderId,
    status: toCanonicalStatus(raw.orderState),
    currency: "INR",
    totalAmount: (raw.priceComponents?.sellingPrice || 0) * raw.quantity,
    customer: { name: raw.customerName || "Flipkart Customer" },
    items: [
      {
        channelOrderItemId: raw.orderItemId,
        sku: raw.sku,
        name: raw.title,
        quantity: raw.quantity,
        unitPrice: raw.priceComponents?.sellingPrice || 0,
      },
    ],
    createdAt: raw.orderDate,
  };
}

export function mapFlipkartShipment(raw: FlipkartShipmentRaw): AdapterShipment {
  return {
    channelShipmentId: raw.shipmentId,
    channelOrderId: raw.orderId,
    status: mapShipmentStatus(raw.status),
    fulfillmentType: "FLIPKART",
    carrier: raw.courierName || "Ekart",
    trackingNumber: raw.trackingId,
  };
}
