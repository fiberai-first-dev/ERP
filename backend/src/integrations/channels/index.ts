/**
 * Sales channel integrations — plug-and-play entrypoint.
 *
 * To add a channel:
 * 1. Implement SalesChannelAdapter (or wrap via legacyFactory)
 * 2. Add a ChannelPlugin in providers/
 * 3. Append to channelProviderPlugins
 * Do NOT modify core order/inventory/fulfillment engines.
 */
import { channelRegistry } from "./registry.js";
import { channelProviderPlugins } from "./providers/index.js";

let bootstrapped = false;

export function bootstrapChannelIntegrations() {
  if (bootstrapped) return;
  for (const plugin of channelProviderPlugins) {
    if (!channelRegistry.has(plugin.definition.id)) {
      channelRegistry.register(plugin);
    }
  }
  bootstrapped = true;
}

bootstrapChannelIntegrations();

export { channelRegistry } from "./registry.js";
export * from "./catalog.js";
export * from "./core/index.js";
export type { ChannelPlugin } from "./registry.js";
export { channelProviderPlugins } from "./providers/index.js";
