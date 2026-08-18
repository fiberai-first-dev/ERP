/**
 * Sales-channel adapter contract.
 * Core services talk only to this interface — never Shopify/Amazon/Flipkart clients directly.
 */
export type {
  AdapterCredentials,
  AdapterProduct,
  AdapterOrderItem,
  AdapterOrder,
  AdapterShipment,
  PickupSlot,
  FulfillOrderInput,
  InventoryUpdateInput,
  ProductSyncInput,
  CreateTestOrderItem,
  CreateTestOrderInput,
  CreateTestOrderResult,
  ChannelAdapter,
  AdapterFactory,
} from "./SalesChannelAdapter.js";

/** Preferred name going forward. */
export type { ChannelAdapter as SalesChannelAdapter } from "./SalesChannelAdapter.js";
