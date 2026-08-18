import { ShopifyAdapter } from "./ShopifyAdapter.js";
import type { SalesChannelPlugin } from "../plugin.js";

export const shopifyPlugin: SalesChannelPlugin = {
  channel: "SHOPIFY",
  Adapter: ShopifyAdapter,
};

export { ShopifyAdapter };
