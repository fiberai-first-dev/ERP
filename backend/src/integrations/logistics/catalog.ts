import type { LogisticsIntegrationDefinition } from "./core/capabilities.js";
import { logisticsRegistry } from "./registry.js";

export function getLogisticsCatalog(): LogisticsIntegrationDefinition[] {
  return logisticsRegistry.listDefinitions();
}

export function getLogisticsDefinition(id: string): LogisticsIntegrationDefinition {
  return logisticsRegistry.getDefinition(id);
}

export function availableLogisticsFor(salesChannelId: string): LogisticsIntegrationDefinition[] {
  return logisticsRegistry.availableForChannel(salesChannelId);
}

export function getLogisticsCredentialSchema(id: string) {
  return getLogisticsDefinition(id).credentialSchema;
}
