import { AdapterOrder, AdapterProduct, AdapterShipment } from "../SalesChannelAdapter.js";
import { ShipmentStatus } from "../../../models/domain.js";
import { AmazonListingRaw, AmazonOrderRaw, AmazonShipmentRaw } from "./amazonClient.js";
import { toCanonicalStatus } from "../../../services/orderLifecycle.js";

function mapShipmentStatus(status: string): ShipmentStatus {
  const s = status.toUpperCase();
  if (s.includes("DELIVER")) return "DELIVERED";
  if (s.includes("RTO") || s.includes("RETURN")) return "RTO";
  if (s.includes("TRANSIT") || s.includes("PICKED")) return "IN_TRANSIT";
  if (s.includes("PENDINGPICK") || s.includes("READY")) return "READY_FOR_PICKUP";
  if (s.includes("SCHEDULE") || s.includes("PENDING")) return "PENDING";
  return "PENDING";
}

export function mapAmazonProduct(raw: AmazonListingRaw): AdapterProduct {
  return {
    channelProductId: raw.asin,
    sku: raw.sellerSku,
    name: raw.itemName,
    price: raw.price,
    quantity: raw.quantity,
    description: raw.description,
  };
}

export function mapAmazonOrder(raw: AmazonOrderRaw): AdapterOrder {
  return {
    channelOrderId: raw.AmazonOrderId,
    status: toCanonicalStatus(raw.OrderStatus),
    currency: raw.OrderTotal?.CurrencyCode || "INR",
    totalAmount: Number(raw.OrderTotal?.Amount || 0),
    customer: {
      name: raw.BuyerInfo?.Name || "Amazon Customer",
      email: raw.BuyerInfo?.Email,
      phone: raw.BuyerInfo?.Phone,
      address: raw.ShippingAddress?.AddressLine1,
    },
    items: raw.OrderItems.map((item) => ({
      channelOrderItemId: item.OrderItemId,
      channelProductId: item.ASIN,
      sku: item.SellerSKU,
      name: item.Title,
      quantity: item.QuantityOrdered,
      unitPrice: Number(item.ItemPrice?.Amount || 0),
    })),
    createdAt: raw.PurchaseDate,
  };
}

export function mapAmazonShipment(raw: AmazonShipmentRaw): AdapterShipment {
  return {
    channelShipmentId: raw.EasyShipShipmentId,
    channelOrderId: raw.AmazonOrderId,
    status: mapShipmentStatus(raw.status),
    fulfillmentType: "AMAZON",
    carrier: raw.carrier || "Amazon Logistics",
    trackingNumber: raw.trackingId,
    metadata: { scheduledSlot: raw.scheduledSlot },
    shippedAt: raw.shippedAt,
    deliveredAt: raw.deliveredAt,
  };
}
