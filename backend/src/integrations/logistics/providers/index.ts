/**
 * Maps every registered legacy logistics plugin into the canonical logisticsRegistry.
 * Adding a courier remains: implement under adapters/logisticsRegistry/<name> (Phase 2: providers/).
 */
import {
  getLogisticsCatalog as getLegacyCatalog,
  logisticsRegistry as legacyLogisticsRegistry,
  type LogisticsServiceMeta,
} from "../../../adapters/logisticsRegistry/index.js";
import type { LogisticsPlugin } from "../registry.js";
import type { LogisticsIntegrationDefinition } from "../core/capabilities.js";
import type { CredentialField } from "../core/types.js";

function toDefinition(meta: LogisticsServiceMeta): LogisticsIntegrationDefinition {
  const credentialSchema: CredentialField[] = meta.requiredFields.map((f) => ({
    name: f.key,
    label: f.label,
    type: f.type === "password" ? "password" : "text",
    required: true,
  }));

  return {
    id: meta.id,
    name: meta.label,
    category: "LOGISTICS",
    kind: meta.kind,
    description: meta.description,
    supportedChannels: [...meta.supportedChannels],
    marketplaceChannel: meta.marketplaceChannel,
    capabilities: {
      createShipment: meta.capabilities.createShipment,
      schedulePickup: meta.capabilities.schedulePickup,
      generateLabel: meta.capabilities.generateLabel,
      tracking: meta.capabilities.tracking,
      cancelShipment: meta.capabilities.cancelShipment,
      pickupSlots: meta.capabilities.schedulePickup,
    },
    credentialSchema,
  };
}

export function buildLogisticsProviderPlugins(): LogisticsPlugin[] {
  return getLegacyCatalog().map((meta) => ({
    definition: toDefinition(meta),
    legacyFactory: () => legacyLogisticsRegistry.get(meta.id),
  }));
}
