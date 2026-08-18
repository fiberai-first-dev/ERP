import type {
  ChannelCredentials,
  ChannelFulfillment,
  ChannelInventoryItem,
  ChannelOrder,
  ChannelProduct,
  CreateFulfillmentInput,
  InventoryQuery,
  InventoryUpdate,
  OrderQuery,
  ProductQuery,
  TrackingUpdate,
  UpdateFulfillmentInput,
  WebhookHandleResult,
} from "./types.js";
import type { ChannelCapabilities } from "./capabilities.js";
import type { SalesChannelId } from "./types.js";

/**
 * Plug-and-play sales channel contract.
 *
 * Core order/inventory/fulfillment engines must only call this interface.
 * Provider SDKs and marketplace jargon stay inside providers/*.
 */
export interface SalesChannelAdapter {
  readonly id: SalesChannelId;
  readonly capabilities: ChannelCapabilities;

  validateCredentials(): Promise<boolean>;
  connect(credentials: ChannelCredentials): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Promise<{ connected: boolean; details?: string }>;

  getProducts(params?: ProductQuery): Promise<ChannelProduct[]>;
  getProduct(id: string): Promise<ChannelProduct | null>;

  getInventory(params?: InventoryQuery): Promise<ChannelInventoryItem[]>;
  updateInventory(items: InventoryUpdate[]): Promise<void>;

  getOrders(params?: OrderQuery): Promise<ChannelOrder[]>;
  getOrder(id: string): Promise<ChannelOrder | null>;

  createFulfillment(input: CreateFulfillmentInput): Promise<ChannelFulfillment>;
  updateFulfillment(input: UpdateFulfillmentInput): Promise<void>;
  updateTracking(input: TrackingUpdate): Promise<void>;

  handleWebhook(
    payload: unknown,
    headers?: Record<string, string>
  ): Promise<WebhookHandleResult>;
}
