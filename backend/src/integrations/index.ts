/**
 * Integration platform entry — sales channels + logistics as plugins.
 * Import this once at process boot (server / workers).
 */
import "./channels/index.js";
import "./logistics/index.js";

export {
  channelRegistry,
  getChannelCatalog,
  getChannelDefinition,
  getChannelCredentialSchema,
  bootstrapChannelIntegrations,
} from "./channels/index.js";

export {
  logisticsRegistry,
  getLogisticsCatalog,
  getLogisticsDefinition,
  availableLogisticsFor,
  getLogisticsCredentialSchema,
  bootstrapLogisticsIntegrations,
} from "./logistics/index.js";

export type { SalesChannelAdapter, ChannelIntegrationDefinition } from "./channels/core/index.js";
export type { LogisticsAdapter, LogisticsIntegrationDefinition } from "./logistics/core/index.js";
