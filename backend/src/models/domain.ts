export type ChannelType = "AMAZON" | "FLIPKART" | "SHOPIFY";
export type ChannelStatus = "CONNECTED" | "DISCONNECTED" | "ERROR";

export type LogisticsPartnerId =
  | "DELHIVERY"
  | "BLUEDART"
  | "SHIPROCKET"
  | "ECOM_EXPRESS"
  | "XPRESSBEES"
  | "DTDC"
  | "SHADOWFAX"
  | "EKART"
  | "AMAZON_SHIPPING"
  | "GATI"
  | "FEDEX"
  | "INDIA_POST"
  | "BLITZ"
  | "ITHINK_LOGISTICS"
  | "MANUAL_COURIER";

/** Canonical internal order lifecycle (marketplace adapters map into this). */
export type OrderStatus =
  | "NEW"
  | "CONFIRMED"
  | "READY_TO_PACK"
  | "PACKED"
  | "SHIPMENT_CREATED"
  | "PICKUP_SCHEDULED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURN_REQUESTED"
  | "RETURNED"
  | "DELIVERY_FAILED";

export type ShipmentStatus =
  | "PENDING"
  | "LABEL_CREATED"
  | "READY_FOR_PICKUP"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "RTO"
  | "CANCELLED";

export type LogisticsConfigStatus = "CONNECTED" | "DISCONNECTED" | "ERROR";
/** @deprecated use LogisticsConfigStatus */
export type LogisticsConnectionStatus = LogisticsConfigStatus;

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  description: string;
  quantity: number;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  channelOrderItemId: string | null;
  channelProductId: string | null;
  channelSku: string;
  skuName: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  channelConfigId: string | null;
  channelOrderId: string;
  customerId: string | null;
  status: OrderStatus;
  lastStatusSource: string | null;
  totalAmount: number;
  currency: string;
  marketplace: ChannelType | string;
  packedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface Shipment {
  id: string;
  orderId: string;
  channelShipmentId: string | null;
  status: ShipmentStatus;
  fulfillmentType: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  metadata: Record<string, unknown>;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Per-channel logistics settings (1:1 with channels_config). */
export interface LogisticsConfig {
  id: string;
  channelConnectionId: string;
  /** Null when fulfillment method is marketplace-native (FBA, NFBF, Easy Ship, …). */
  providerType: LogisticsPartnerId | null;
  credentialsEncrypted: string | null;
  status: LogisticsConfigStatus;
  createdAt: string;
  updatedAt: string;
}

/** @deprecated use LogisticsConfig */
export type LogisticsConnection = LogisticsConfig & { label?: string | null };

export interface ChannelConfig {
  id: string;
  channel: ChannelType;
  credentialsEncrypted: string | null;
  status: ChannelStatus;
  /**
   * When false, channel is not active (sync/fulfillment skipped).
   * Managed automatically on connect/disconnect — not a Settings toggle.
   */
  enabled: boolean;
  /** Channel-specific method: FBA, NFBF, SELF_SHIP, … */
  fulfillmentMethod: string | null;
  logisticsConfigId: string | null;
  /** External logistics only when fulfillment method requires it. */
  logisticsProvider: LogisticsPartnerId | null;
  logisticsCredentialsEncrypted: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}
