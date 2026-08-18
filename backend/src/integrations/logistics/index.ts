/**
 * Logistics integrations — plug-and-play entrypoint.
 *
 * Channel × logistics are independent. Compatibility = supportedChannels on the definition.
 * To add a provider: register a LogisticsPlugin (legacyFactory wrap OK in Phase 1).
 * Do NOT modify the fulfillment engine.
 */
import { logisticsRegistry } from "./registry.js";
import { buildLogisticsProviderPlugins } from "./providers/index.js";

let bootstrapped = false;

export function bootstrapLogisticsIntegrations() {
  if (bootstrapped) return;
  for (const plugin of buildLogisticsProviderPlugins()) {
    if (!logisticsRegistry.has(plugin.definition.id)) {
      logisticsRegistry.register(plugin);
    }
  }
  bootstrapped = true;
}

bootstrapLogisticsIntegrations();

export { logisticsRegistry } from "./registry.js";
export * from "./catalog.js";
export * from "./core/index.js";
export type { LogisticsPlugin } from "./registry.js";
export { buildLogisticsProviderPlugins } from "./providers/index.js";
