import type { CredentialField } from "./types.js";

/** Declarative capabilities — Settings UI and core gates use these, never provider names. */
export interface ChannelCapabilities {
  inventory: boolean;
  orders: boolean;
  fulfillment: boolean;
  tracking: boolean;
  webhooks: boolean;
  /** Push self-ship tracking back to the marketplace after 3PL shipment. */
  notifySelfShip: boolean;
  createTestOrder: boolean;
  sandboxLifecycle: boolean;
}

export const DEFAULT_CHANNEL_CAPABILITIES: ChannelCapabilities = {
  inventory: true,
  orders: true,
  fulfillment: true,
  tracking: true,
  webhooks: true,
  notifySelfShip: false,
  createTestOrder: false,
  sandboxLifecycle: false,
};

export interface ChannelIntegrationDefinition {
  id: string;
  name: string;
  category: "CHANNEL";
  logo?: string;
  description?: string;
  capabilities: ChannelCapabilities;
  credentialSchema: CredentialField[];
  /** Logistics providers this channel can ship with; empty = all that support the channel. */
  preferredLogisticsIds?: string[];
}
