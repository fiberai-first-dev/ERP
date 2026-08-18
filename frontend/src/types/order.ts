export enum OrderStatus {
  NEW = "NEW",
  CONFIRMED = "CONFIRMED",
  READY_TO_PACK = "READY_TO_PACK",
  PACKED = "PACKED",
  SHIPMENT_CREATED = "SHIPMENT_CREATED",
  PICKUP_SCHEDULED = "PICKUP_SCHEDULED",
  PICKED_UP = "PICKED_UP",
  IN_TRANSIT = "IN_TRANSIT",
  OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  RETURN_REQUESTED = "RETURN_REQUESTED",
  RETURNED = "RETURNED",
  DELIVERY_FAILED = "DELIVERY_FAILED",
}

export enum Marketplace {
  SHOPIFY = "SHOPIFY",
  AMAZON = "AMAZON",
  FLIPKART = "FLIPKART",
}

export interface OrderItem {
  skuId: string;
  skuName: string;
  quantity: number;
}

export interface Order {
  id: string;
  marketplace: Marketplace;
  status: OrderStatus;
  lastStatusSource?: string;
  items: OrderItem[];
  createdAt?: string;
  packedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  trackingNumber?: string;
  carrier?: string;
  labelUrl?: string;
}
