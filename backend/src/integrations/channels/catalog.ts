import type { ChannelIntegrationDefinition } from "./core/capabilities.js";
import { channelRegistry } from "./registry.js";

/** Live channel catalog driven by registered plugins. */
export function getChannelCatalog(): ChannelIntegrationDefinition[] {
  return channelRegistry.listDefinitions();
}

export function getChannelDefinition(id: string): ChannelIntegrationDefinition {
  return channelRegistry.getDefinition(id);
}

/** Settings UI: credential fields for a channel. */
export function getChannelCredentialSchema(id: string) {
  return getChannelDefinition(id).credentialSchema;
}
