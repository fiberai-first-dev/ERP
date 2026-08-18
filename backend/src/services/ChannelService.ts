import { z } from "zod";
import { channelRepository } from "../repositories/channel.repository.js";
import { logisticsConfigRepository } from "../repositories/logisticsConfig.repository.js";
import { createAdapter, listRegisteredChannels } from "../adapters/salesChannelRegistry/index.js";
import { encryptJson } from "../utils/crypto.js";
import { ChannelType, LogisticsPartnerId } from "../models/domain.js";
import { AppError } from "../middleware/errorHandler.js";
import { syncOrdersForChannel } from "../jobs/syncOrders.js";
import { syncInventoryToChannels } from "../jobs/syncInventory.js";
import { syncShipments } from "../jobs/syncShipments.js";
import {
  CHANNEL_CREDENTIAL_META,
  parseChannelCredentials,
} from "../adapters/salesChannelRegistry/credentialSchemas.js";
import {
  defaultFulfillmentMethodId,
  fulfillmentMethodsFor,
  getFulfillmentMethod,
} from "../adapters/salesChannelRegistry/fulfillmentMethods.js";
import { logger } from "../utils/logger.js";
import { publishEvent } from "../events/eventBus.js";
import {
  availableLogisticsFor,
  defaultLogisticsProvider,
  getLogisticsServiceMeta,
  isLogisticsServiceId,
  parseLogisticsCredentials,
  connectLogisticsPartner,
  logisticsRequiresCredentials,
} from "../adapters/logisticsRegistry/index.js";

const connectSchema = z.object({
  credentials: z.record(z.string()),
  fulfillmentMethod: z.string().optional(),
  logisticsProvider: z.string().optional().nullable(),
  logisticsCredentials: z.record(z.string()).optional(),
});

const logisticsSchema = z.object({
  fulfillmentMethod: z.string().optional(),
  logisticsProvider: z.string().optional().nullable(),
  logisticsCredentials: z.record(z.string()).optional(),
});

function toPublic(config: {
  id: string;
  channel: ChannelType;
  status: string;
  fulfillmentMethod?: string | null;
  logisticsConfigId?: string | null;
  logisticsProvider?: string | null;
  hasLogisticsCredentials?: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastError: string | null;
  hasCredentials: boolean;
}) {
  const channel = config.channel;
  const fulfillmentMethods = fulfillmentMethodsFor(channel);
  const method =
    getFulfillmentMethod(channel, config.fulfillmentMethod) ||
    getFulfillmentMethod(channel, defaultFulfillmentMethodId(channel))!;

  const logisticsPartners = availableLogisticsFor(channel).map((p) => ({
    id: p.id,
    label: p.label,
    kind: p.kind,
    supportedChannels: p.supportedChannels,
    requiredFields: p.requiredFields,
    capabilities: p.capabilities,
  }));

  const logisticsProvider = method.requiresLogisticsProvider
    ? config.logisticsProvider || null
    : null;

  const logisticsMeta =
    logisticsProvider && isLogisticsServiceId(logisticsProvider)
      ? getLogisticsServiceMeta(logisticsProvider)
      : null;

  return {
    id: config.id,
    channel,
    status: config.status,
    fulfillmentMethod: method.id,
    fulfillmentMethodLabel: method.name,
    fulfillmentMethods,
    logisticsConfigId: config.logisticsConfigId || null,
    logisticsProvider,
    logisticsKind: logisticsMeta?.kind || null,
    logisticsRequiresCredentials: logisticsMeta
      ? logisticsMeta.requiredFields.length > 0
      : false,
    logisticsCapabilities: logisticsMeta?.capabilities || null,
    hasLogisticsCredentials: Boolean(config.hasLogisticsCredentials),
    logisticsPartners,
    lastSyncAt: config.lastSyncAt,
    lastSyncStatus: config.lastSyncStatus,
    lastError: config.lastError,
    hasCredentials: config.hasCredentials,
    requiredFields: CHANNEL_CREDENTIAL_META[channel] || [],
  };
}

/**
 * Persist external logistics only when the selected fulfillment method requires it.
 */
async function saveFulfillmentConfig(
  channel: ChannelType,
  channelConnectionId: string,
  opts: {
    fulfillmentMethod?: string | null;
    logisticsProvider?: string | null;
    logisticsCredentials?: Record<string, string>;
    existingProvider?: string | null;
    hasExistingCreds?: boolean;
    allowMissingCredsIfUnchanged?: boolean;
  }
): Promise<{ fulfillmentMethod: string; logisticsProvider: LogisticsPartnerId | null }> {
  const methodId = opts.fulfillmentMethod || defaultFulfillmentMethodId(channel);
  const method = getFulfillmentMethod(channel, methodId);
  if (!method) {
    throw new AppError(`Unknown fulfillment method for ${channel}: ${methodId}`, 400);
  }

  await channelRepository.setFulfillmentMethod(channel, method.id);

  if (!method.requiresLogisticsProvider) {
    // FBA / Easy Ship / FBF / NFBF — no external logistics connection
    if (opts.logisticsProvider) {
      throw new AppError(
        `${method.name} does not use an external logistics partner`,
        400
      );
    }
    await logisticsConfigRepository.upsert({
      channelConnectionId,
      providerType: null,
      credentialsEncrypted: null,
      status: "CONNECTED",
    });
    return { fulfillmentMethod: method.id, logisticsProvider: null };
  }

  // Self Ship / Third-party — require external provider
  const providerRaw =
    opts.logisticsProvider ||
    opts.existingProvider ||
    defaultLogisticsProvider(channel);
  if (!providerRaw || !isLogisticsServiceId(providerRaw)) {
    throw new AppError("Select a logistics partner for this fulfillment method", 400);
  }
  const allowed = availableLogisticsFor(channel).some((p) => p.id === providerRaw);
  if (!allowed) {
    throw new AppError(`${providerRaw} is not available for ${channel}`, 400);
  }

  const meta = getLogisticsServiceMeta(providerRaw);
  const provided = opts.logisticsCredentials || {};
  const hasProvided = Object.values(provided).some((v) => String(v || "").trim());
  const sameProvider = opts.existingProvider === providerRaw;
  const needsCreds = logisticsRequiresCredentials(providerRaw);

  if (needsCreds) {
    const canKeep =
      opts.allowMissingCredsIfUnchanged &&
      sameProvider &&
      opts.hasExistingCreds &&
      !hasProvided;

    if (canKeep) {
      await logisticsConfigRepository.upsert({
        channelConnectionId,
        providerType: providerRaw,
        status: "CONNECTED",
      });
      return { fulfillmentMethod: method.id, logisticsProvider: providerRaw };
    }

    const logisticsCredentials = parseLogisticsCredentials(providerRaw, provided);
    await connectLogisticsPartner(providerRaw, logisticsCredentials);
    await logisticsConfigRepository.upsert({
      channelConnectionId,
      providerType: providerRaw,
      credentialsEncrypted: encryptJson(logisticsCredentials),
      status: "CONNECTED",
    });
    return { fulfillmentMethod: method.id, logisticsProvider: providerRaw };
  }

  await connectLogisticsPartner(providerRaw, {});
  await logisticsConfigRepository.upsert({
    channelConnectionId,
    providerType: providerRaw,
    credentialsEncrypted: null,
    status: "CONNECTED",
  });
  return { fulfillmentMethod: method.id, logisticsProvider: providerRaw };
}

export class ChannelService {
  async listPublic() {
    const registered = listRegisteredChannels();
    const configs = await channelRepository.list();
    const byChannel = new Map(configs.map((c) => [c.channel, c]));

    return registered.map((channel) => {
      const config = byChannel.get(channel);
      return toPublic({
        id: config?.id || channel,
        channel,
        status: config?.status || "DISCONNECTED",
        fulfillmentMethod: config?.fulfillmentMethod || null,
        logisticsConfigId: config?.logisticsConfigId || null,
        logisticsProvider: config?.logisticsProvider || null,
        hasLogisticsCredentials: !!config?.logisticsCredentialsEncrypted,
        lastSyncAt: config?.lastSyncAt || null,
        lastSyncStatus: config?.lastSyncStatus || null,
        lastError: config?.lastError || null,
        hasCredentials: !!config?.credentialsEncrypted,
      });
    });
  }

  async connect(channelRaw: string, body: unknown) {
    const channel = channelRaw.toUpperCase() as ChannelType;
    if (!listRegisteredChannels().includes(channel)) {
      throw new AppError(`Unknown channel: ${channel}`, 400);
    }

    const parsed = connectSchema
      .extend({
        logisticsConnectionId: z.string().uuid().optional().nullable(),
        logisticsLabel: z.string().optional().nullable(),
      })
      .parse(body);
    const credentials = parseChannelCredentials(channel, parsed.credentials);

    const adapter = createAdapter(channel);
    try {
      await adapter.connect(credentials);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed";
      await channelRepository.setStatus(channel, "ERROR", message);
      throw new AppError(message, 401);
    }

    const status = await adapter.getStatus();
    if (!status.connected) {
      await channelRepository.setStatus(channel, "ERROR", status.details || "Validation failed");
      throw new AppError(status.details || "Could not validate channel credentials", 401);
    }

    const saved = await channelRepository.upsertConnection(
      channel,
      encryptJson(credentials),
      "CONNECTED"
    );

    await saveFulfillmentConfig(channel, saved.id, {
      fulfillmentMethod: parsed.fulfillmentMethod,
      logisticsProvider: parsed.logisticsProvider,
      logisticsCredentials: parsed.logisticsCredentials,
    });

    void Promise.all([syncOrdersForChannel(channel), syncInventoryToChannels()]).catch((err) =>
      logger.warn({ err, channel }, "Post-connect sync failed")
    );

    await publishEvent({
      type: "channel.status",
      payload: { channel, status: "CONNECTED" },
    });

    const refreshed = await channelRepository.findByChannel(channel);
    return toPublic({
      id: saved.id,
      channel: saved.channel,
      status: saved.status,
      fulfillmentMethod: refreshed?.fulfillmentMethod || null,
      logisticsConfigId: refreshed?.logisticsConfigId || null,
      logisticsProvider: refreshed?.logisticsProvider || null,
      hasLogisticsCredentials: !!refreshed?.logisticsCredentialsEncrypted,
      lastSyncAt: saved.lastSyncAt,
      lastSyncStatus: saved.lastSyncStatus,
      lastError: saved.lastError,
      hasCredentials: true,
    });
  }

  /** Update fulfillment method and/or external logistics for a connected channel. */
  async updateFulfillmentType(channelRaw: string, body: unknown) {
    const channel = channelRaw.toUpperCase() as ChannelType;
    if (!listRegisteredChannels().includes(channel)) {
      throw new AppError(`Unknown channel: ${channel}`, 400);
    }
    const parsed = logisticsSchema
      .extend({
        fulfillmentType: z.string().optional(),
        logisticsConnectionId: z.string().uuid().optional().nullable(),
        logisticsLabel: z.string().optional().nullable(),
      })
      .parse(body);
    const existing = await channelRepository.findByChannel(channel);
    if (!existing || existing.status !== "CONNECTED") {
      throw new AppError("Connect the channel first", 400);
    }

    await saveFulfillmentConfig(channel, existing.id, {
      fulfillmentMethod: parsed.fulfillmentMethod || existing.fulfillmentMethod,
      logisticsProvider: parsed.logisticsProvider,
      logisticsCredentials: parsed.logisticsCredentials,
      existingProvider: existing.logisticsProvider,
      hasExistingCreds: !!existing.logisticsCredentialsEncrypted,
      allowMissingCredsIfUnchanged: true,
    });

    const saved = await channelRepository.findByChannel(channel);
    if (!saved) throw new AppError("Channel not found", 404);

    await publishEvent({
      type: "channel.status",
      payload: { channel, status: saved.status },
    });

    return toPublic({
      id: saved.id,
      channel: saved.channel,
      status: saved.status,
      fulfillmentMethod: saved.fulfillmentMethod,
      logisticsConfigId: saved.logisticsConfigId,
      logisticsProvider: saved.logisticsProvider,
      hasLogisticsCredentials: !!saved.logisticsCredentialsEncrypted,
      lastSyncAt: saved.lastSyncAt,
      lastSyncStatus: saved.lastSyncStatus,
      lastError: saved.lastError,
      hasCredentials: !!saved.credentialsEncrypted,
    });
  }

  async disconnect(channelRaw: string) {
    const channel = channelRaw.toUpperCase() as ChannelType;
    const adapter = createAdapter(channel);
    await adapter.disconnect();
    const saved = await channelRepository.setStatus(channel, "DISCONNECTED");
    if (!saved) throw new AppError("Channel not found", 404);
    await publishEvent({
      type: "channel.status",
      payload: { channel, status: "DISCONNECTED" },
    });
    return toPublic({
      id: saved.id,
      channel: saved.channel,
      status: saved.status,
      fulfillmentMethod: saved.fulfillmentMethod,
      logisticsConfigId: saved.logisticsConfigId,
      logisticsProvider: null,
      hasLogisticsCredentials: false,
      lastSyncAt: saved.lastSyncAt,
      lastSyncStatus: saved.lastSyncStatus,
      lastError: saved.lastError,
      hasCredentials: false,
    });
  }

  async sync(channelRaw: string) {
    const channel = channelRaw.toUpperCase() as ChannelType;
    await syncOrdersForChannel(channel);
    await syncShipments();
    return { ok: true };
  }

  async syncAll() {
    const configs = await channelRepository.list();
    const active = configs.filter((c) => c.status === "CONNECTED" && c.enabled);
    const results: Array<{ channel: string; ok: boolean; error?: string }> = [];

    await Promise.all(
      active.map(async (config) => {
        try {
          await syncOrdersForChannel(config.channel);
          results.push({ channel: config.channel, ok: true });
        } catch (error) {
          results.push({
            channel: config.channel,
            ok: false,
            error: error instanceof Error ? error.message : "Sync failed",
          });
        }
      })
    );

    await syncInventoryToChannels();
    await syncShipments();
    return { ok: true, results };
  }
}

export const channelService = new ChannelService();
