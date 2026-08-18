import { ChannelAdapter } from "../adapters/salesChannelRegistry/SalesChannelAdapter.js";
import { createAdapter } from "../adapters/salesChannelRegistry/index.js";
import { channelRepository } from "../repositories/channel.repository.js";
import { decryptJson, encryptJson, looksLikeEncryptedPayload } from "../utils/crypto.js";
import { ChannelType } from "../models/domain.js";
import { logger } from "../utils/logger.js";

function isCredentialCryptoError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("initialization vector")
    || message.includes("unable to authenticate")
    || message.includes("bad decrypt")
    || message.includes("unsupported state")
    || message.includes("stored credentials are invalid")
  );
}

export class ChannelManager {
  async getConnectedAdapters(): Promise<ChannelAdapter[]> {
    const configs = await channelRepository.list();
    const adapters: ChannelAdapter[] = [];

    for (const config of configs) {
      if (!config.enabled || config.status !== "CONNECTED" || !config.credentialsEncrypted) {
        continue;
      }
      try {
        const adapter = await this.loadAdapter(config.channel, config.credentialsEncrypted);
        adapters.push(adapter);
      } catch (error) {
        logger.warn({ err: error, channel: config.channel }, "Failed to load connected adapter");
        if (isCredentialCryptoError(error) || !looksLikeEncryptedPayload(config.credentialsEncrypted)) {
          await channelRepository.setStatus(config.channel, "DISCONNECTED", null);
          continue;
        }
        await channelRepository.setStatus(
          config.channel,
          "ERROR",
          error instanceof Error ? error.message : "Adapter load failed"
        );
      }
    }

    return adapters;
  }

  async getAdapter(channel: ChannelType): Promise<ChannelAdapter | null> {
    const config = await channelRepository.findByChannel(channel);
    if (
      !config
      || !config.enabled
      || config.status !== "CONNECTED"
      || !config.credentialsEncrypted
    ) {
      return null;
    }
    try {
      return await this.loadAdapter(config.channel, config.credentialsEncrypted);
    } catch (error) {
      if (isCredentialCryptoError(error) || !looksLikeEncryptedPayload(config.credentialsEncrypted)) {
        await channelRepository.setStatus(channel, "DISCONNECTED", null);
        return null;
      }
      throw error;
    }
  }

  /** Connects the adapter and persists refreshed tokens (e.g. Shopify ~24h client credentials). */
  private async loadAdapter(channel: ChannelType, credentialsEncrypted: string): Promise<ChannelAdapter> {
    if (!looksLikeEncryptedPayload(credentialsEncrypted)) {
      throw new Error("Stored credentials are invalid. Reconnect the channel.");
    }
    const credentials = decryptJson(credentialsEncrypted);
    const before = JSON.stringify(credentials);
    const adapter = createAdapter(channel, credentials);
    await adapter.connect(credentials);
    if (JSON.stringify(credentials) !== before) {
      await channelRepository.upsertConnection(channel, encryptJson(credentials), "CONNECTED");
      logger.info({ channel }, "Persisted refreshed channel credentials");
    }
    return adapter;
  }
}

export const channelManager = new ChannelManager();
