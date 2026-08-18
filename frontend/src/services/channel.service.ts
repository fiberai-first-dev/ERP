import { api } from "./api";

export interface CredentialField {
  key: string;
  label: string;
  type?: "password" | "text";
}

export interface LogisticsCapabilities {
  createShipment: boolean;
  schedulePickup: boolean;
  generateLabel: boolean;
  tracking: boolean;
  cancelShipment: boolean;
}

export interface FulfillmentMethodOption {
  id: string;
  name: string;
  requiresLogisticsProvider: boolean;
  defaultLogisticsProvider?: string;
  description?: string;
  capabilities?: {
    shipmentCreation?: boolean;
    labelGeneration?: boolean;
    pickupScheduling?: boolean;
    tracking?: boolean;
  };
}

export interface LogisticsPartnerOption {
  id: string;
  label: string;
  description?: string;
  kind?: "MARKETPLACE" | "EXTERNAL";
  supportedChannels?: string[];
  requiredFields: CredentialField[];
  capabilities?: LogisticsCapabilities;
}

export interface ChannelSummary {
  id: string;
  channel: string;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  fulfillmentMethod?: string | null;
  fulfillmentMethodLabel?: string | null;
  fulfillmentMethods?: FulfillmentMethodOption[];
  logisticsConfigId?: string | null;
  logisticsProvider?: string | null;
  logisticsKind?: "MARKETPLACE" | "EXTERNAL" | null;
  logisticsRequiresCredentials?: boolean;
  logisticsCapabilities?: LogisticsCapabilities | null;
  hasLogisticsCredentials?: boolean;
  logisticsPartners?: LogisticsPartnerOption[];
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastError: string | null;
  hasCredentials: boolean;
  requiredFields?: CredentialField[];
}

export async function getChannels(): Promise<ChannelSummary[]> {
  return api<ChannelSummary[]>("/api/channels");
}

export async function connectChannel(
  channel: string,
  credentials: Record<string, string>,
  options: {
    fulfillmentMethod?: string;
    logisticsProvider?: string | null;
    logisticsCredentials?: Record<string, string>;
  }
): Promise<ChannelSummary> {
  return api<ChannelSummary>(`/api/channels/${channel.toLowerCase()}/connect`, {
    method: "POST",
    body: JSON.stringify({
      credentials,
      fulfillmentMethod: options.fulfillmentMethod,
      logisticsProvider: options.logisticsProvider,
      logisticsCredentials: options.logisticsCredentials,
    }),
  });
}

export async function updateChannelLogistics(
  channel: string,
  payload: {
    fulfillmentMethod?: string;
    logisticsProvider?: string | null;
    logisticsCredentials?: Record<string, string>;
  }
): Promise<ChannelSummary> {
  return api<ChannelSummary>(`/api/channels/${channel.toLowerCase()}/logistics`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** @deprecated use updateChannelLogistics */
export async function updateChannelFulfillmentType(
  channel: string,
  payload: {
    fulfillmentMethod?: string;
    logisticsProvider?: string | null;
    logisticsCredentials?: Record<string, string>;
  }
): Promise<ChannelSummary> {
  return updateChannelLogistics(channel, payload);
}

export async function disconnectChannel(channel: string): Promise<ChannelSummary> {
  return api<ChannelSummary>(`/api/channels/${channel.toLowerCase()}/disconnect`, {
    method: "POST",
  });
}
