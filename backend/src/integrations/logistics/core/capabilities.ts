import type { CredentialField } from "./types.js";

export interface LogisticsCapabilities {
  createShipment: boolean;
  schedulePickup: boolean;
  generateLabel: boolean;
  tracking: boolean;
  cancelShipment: boolean;
  pickupSlots: boolean;
}

export const DEFAULT_LOGISTICS_CAPABILITIES: LogisticsCapabilities = {
  createShipment: true,
  schedulePickup: true,
  generateLabel: true,
  tracking: true,
  cancelShipment: true,
  pickupSlots: true,
};

export interface LogisticsIntegrationDefinition {
  id: string;
  name: string;
  category: "LOGISTICS";
  kind: "MARKETPLACE" | "EXTERNAL";
  logo?: string;
  description?: string;
  /** Sales channel ids this logistics provider can ship for. */
  supportedChannels: string[];
  /** When set, this is marketplace-native logistics for that channel. */
  marketplaceChannel?: string;
  capabilities: LogisticsCapabilities;
  credentialSchema: CredentialField[];
}
