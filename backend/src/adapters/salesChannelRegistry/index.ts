/**
 * Sales channel adapters — one folder per marketplace.
 *
 * Canonical contracts & registry: `src/integrations/channels`
 * (this package remains the Phase-1 implementation home).
 *
 * To add a channel:
 * 1. Create salesChannelRegistry/<name>/ with Adapter + client/mapper
 * 2. Export a SalesChannelPlugin from index.ts and append to `plugins` below
 * 3. Also register a ChannelPlugin in integrations/channels/providers
 * Do not modify core order/inventory/fulfillment engines.
 */
import { salesChannelRegistry } from "./registry.js";
import { amazonPlugin } from "./amazon/index.js";
import { flipkartPlugin } from "./flipkart/index.js";
import { shopifyPlugin } from "./shopify/index.js";
import type { SalesChannelPlugin } from "./plugin.js";

const plugins: SalesChannelPlugin[] = [
  amazonPlugin,
  flipkartPlugin,
  shopifyPlugin,
  // MeeshoPlugin,   ← example: add new channel here only
];

for (const plugin of plugins) {
  salesChannelRegistry.register(plugin.channel, plugin.Adapter);
}

export {
  salesChannelRegistry,
  createAdapter,
  listRegisteredChannels,
  registerAdapter,
} from "./registry.js";
export * from "./types.js";
export * from "./credentialSchemas.js";
export type { SalesChannelPlugin } from "./plugin.js";
