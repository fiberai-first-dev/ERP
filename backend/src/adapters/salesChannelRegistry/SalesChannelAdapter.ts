import { ChannelType, OrderStatus, ShipmentStatus } from "../../models/domain.js";

export interface AdapterCredentials {
  [key: string]: string | undefined;
}

export interface AdapterProduct {
  channelProductId: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  description?: string;
}

export interface AdapterOrderItem {
  channelOrderItemId: string;
  channelProductId?: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface AdapterOrder {
  channelOrderId: string;
  status: OrderStatus;
  currency: string;
  totalAmount: number;
  customer?: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  items: AdapterOrderItem[];
  createdAt?: string;
}

export interface AdapterShipment {
  channelShipmentId: string;
  channelOrderId: string;
  status: ShipmentStatus;
  fulfillmentType?: string;
  carrier?: string;
  trackingNumber?: string;
  metadata?: Record<string, unknown>;
  shippedAt?: string;
  deliveredAt?: string;
}

export interface PickupSlot {
  id: string;
  start: string;
  end: string;
}

export interface FulfillOrderInput {
  channelOrderId: string;
  action:
    | "PACK"
    | "SCHEDULE_PICKUP"
    | "MARK_READY"
    | "CREATE_FULFILLMENT"
    /** Merchant / Self-Ship: push tracking + status to the marketplace. */
    | "UPDATE_SHIPMENT";
  pickupSlotId?: string;
  trackingNumber?: string;
  carrier?: string;
  /** Canonical ERM order status being reported (for Self-Ship notify). */
  orderStatus?: string;
  metadata?: Record<string, unknown>;
}

export interface InventoryUpdateInput {
  sku: string;
  quantity: number;
}

export interface ProductSyncInput {
  sku: string;
  name: string;
  price: number;
  quantity: number;
  description?: string;
  imageUrl?: string | null;
}

export interface CreateTestOrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateTestOrderInput {
  items: CreateTestOrderItem[];
  customer: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
}

export interface CreateTestOrderResult {
  /** true when order was created on the external marketplace API */
  createdOnChannel: boolean;
  order: AdapterOrder;
  note?: string;
}

export interface ChannelAdapter {
  readonly channel: ChannelType;

  connect(credentials: AdapterCredentials): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Promise<{ connected: boolean; details?: string }>;

  getProducts(): Promise<AdapterProduct[]>;
  getOrders(since?: Date): Promise<AdapterOrder[]>;
  getOrder(channelOrderId: string): Promise<AdapterOrder | null>;

  getInventory(sku?: string): Promise<AdapterProduct[]>;
  updateInventory(input: InventoryUpdateInput): Promise<void>;
  /** Create or update catalog + stock on the channel when supported. */
  upsertProduct?(input: ProductSyncInput): Promise<void>;

  getShipment(channelOrderId: string): Promise<AdapterShipment | null>;
  fulfillOrder(input: FulfillOrderInput): Promise<AdapterShipment>;

  /**
   * Channel-specific fulfillment methods (FBA, NFBF, Self Ship, …).
   * Core/Settings render these dynamically — never hardcode per channel in UI.
   */
  getFulfillmentMethods(): import("./fulfillmentMethods.js").FulfillmentMethodDefinition[];

  /**
   * Optional: create a test/simulated sale order on the channel.
   * Shopify supports this via Admin API.
   * Amazon / Flipkart seller APIs do not allow creating buyer marketplace orders.
   */
  createTestOrder?(input: CreateTestOrderInput): Promise<CreateTestOrderResult>;

  /**
   * Optional Flipkart-style sandbox lifecycle advance (pickup → ship → deliver).
   * Amazon Orders sandbox is static — not implemented there.
   */
  advanceSandboxLifecycle?(channelOrderId: string, targetCanonicalStatus: OrderStatus): Promise<string>;

  /** Optional Easy Ship / NFBF helpers — adapters may no-op if unsupported */
  getPickupSlots?(channelOrderId: string): Promise<PickupSlot[]>;
}

export interface AdapterFactory {
  create(credentials: AdapterCredentials): ChannelAdapter;
}
