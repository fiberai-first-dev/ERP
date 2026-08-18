/**
 * Adapter layer — two independent plugin systems.
 *
 *   adapters/
 *     salesChannelRegistry/   ← Amazon, Flipkart, Shopify, …
 *     logisticsRegistry/      ← Delhivery, Shiprocket, …
 *
 * Core services import from these registries only.
 */
export * from "./salesChannelRegistry/index.js";
export * from "./logisticsRegistry/index.js";
