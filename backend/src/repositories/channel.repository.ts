import { query } from "../config/db.js";
import {
  ChannelConfig,
  ChannelStatus,
  ChannelType,
  LogisticsPartnerId,
} from "../models/domain.js";
import { isLogisticsPartnerId } from "../adapters/logisticsRegistry/index.js";
import { logisticsConfigRepository } from "./logisticsConfig.repository.js";

function mapRow(row: Record<string, unknown>): ChannelConfig {
  const channel = row.channel as ChannelType;
  const providerRaw = row.provider_type ? String(row.provider_type) : null;
  return {
    id: String(row.id),
    channel,
    credentialsEncrypted:
      row.credentials &&
      typeof row.credentials === "object" &&
      (row.credentials as { enc?: string }).enc
        ? String((row.credentials as { enc: string }).enc)
        : null,
    status: row.status as ChannelStatus,
    enabled: Boolean(row.enabled),
    fulfillmentMethod: row.fulfillment_method ? String(row.fulfillment_method) : null,
    logisticsConfigId: row.lc_id ? String(row.lc_id) : null,
    logisticsProvider:
      providerRaw && isLogisticsPartnerId(providerRaw) ? (providerRaw as LogisticsPartnerId) : null,
    logisticsCredentialsEncrypted:
      row.lc_credentials &&
      typeof row.lc_credentials === "object" &&
      (row.lc_credentials as { enc?: string }).enc
        ? String((row.lc_credentials as { enc: string }).enc)
        : null,
    lastSyncAt: row.last_sync_at ? new Date(String(row.last_sync_at)).toISOString() : null,
    lastSyncStatus: row.last_sync_status ? String(row.last_sync_status) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

const SELECT_JOIN = `
  SELECT cc.*,
         lc.id AS lc_id,
         lc.provider_type,
         lc.credentials AS lc_credentials
  FROM channels_config cc
  LEFT JOIN logistics_configs lc ON lc.channel_connection_id = cc.id
`;

export class ChannelRepository {
  async list(): Promise<ChannelConfig[]> {
    const result = await query(`${SELECT_JOIN} ORDER BY cc.channel`);
    return result.rows.map(mapRow);
  }

  async findByChannel(channel: ChannelType): Promise<ChannelConfig | null> {
    const result = await query(`${SELECT_JOIN} WHERE cc.channel = $1`, [channel]);
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async findById(id: string): Promise<ChannelConfig | null> {
    const result = await query(`${SELECT_JOIN} WHERE cc.id = $1`, [id]);
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async upsertConnection(
    channel: ChannelType,
    encryptedCredentials: string,
    status: ChannelStatus
  ): Promise<ChannelConfig> {
    const enable = status === "CONNECTED";
    const result = await query(
      `INSERT INTO channels_config (channel, credentials, status, enabled)
       VALUES ($1, $2::jsonb, $3, $4)
       ON CONFLICT (channel) DO UPDATE SET
         credentials = EXCLUDED.credentials,
         status = EXCLUDED.status,
         enabled = EXCLUDED.enabled,
         last_error = NULL,
         updated_at = NOW()
       RETURNING id`,
      [channel, JSON.stringify({ enc: encryptedCredentials }), status, enable]
    );
    const id = String(result.rows[0].id);
    const existingLogistics = await logisticsConfigRepository.findByChannelConnectionId(id);
    if (!existingLogistics) {
      await logisticsConfigRepository.upsert({
        channelConnectionId: id,
        providerType: null,
        credentialsEncrypted: null,
        status: "CONNECTED",
      });
    }
    const saved = await this.findById(id);
    if (!saved) throw new Error("Failed to upsert channel connection");
    return saved;
  }

  async setFulfillmentMethod(channel: ChannelType, method: string | null): Promise<void> {
    await query(
      `UPDATE channels_config SET fulfillment_method = $2, updated_at = NOW() WHERE channel = $1`,
      [channel, method]
    );
  }

  async updateLogisticsSettings(
    channel: ChannelType,
    input: {
      providerType: LogisticsPartnerId;
      credentialsEncrypted?: string | null;
    }
  ) {
    const existing = await this.findByChannel(channel);
    if (!existing) return null;
    await logisticsConfigRepository.upsert({
      channelConnectionId: existing.id,
      providerType: input.providerType,
      credentialsEncrypted: input.credentialsEncrypted,
      status: "CONNECTED",
    });
    return this.findByChannel(channel);
  }

  /** @deprecated use updateLogisticsSettings */
  async updateFulfillmentSettings(
    channel: ChannelType,
    input: { logisticsConnectionId?: string | null; providerType?: LogisticsPartnerId }
  ) {
    if (!input.providerType) return this.findByChannel(channel);
    return this.updateLogisticsSettings(channel, {
      providerType: input.providerType,
      credentialsEncrypted: undefined,
    });
  }

  /** Internal: track active connected channels (not user-facing). */
  async setEnabled(channel: ChannelType, enabled: boolean) {
    const result = await query(
      `UPDATE channels_config
       SET enabled = $2,
           updated_at = NOW()
       WHERE channel = $1
       RETURNING id`,
      [channel, enabled]
    );
    if (!result.rows[0]) return null;
    return this.findByChannel(channel);
  }

  async setStatus(channel: ChannelType, status: ChannelStatus, lastError: string | null = null) {
    const clearCreds = status === "DISCONNECTED";
    const disable = status === "DISCONNECTED" || status === "ERROR";
    const result = await query(
      `UPDATE channels_config
       SET status = $2,
           last_error = $3,
           enabled = CASE WHEN $5 THEN false ELSE enabled END,
           credentials = CASE WHEN $4 THEN '{}'::jsonb ELSE credentials END,
           updated_at = NOW()
       WHERE channel = $1
       RETURNING id`,
      [channel, status, lastError, clearCreds, disable]
    );
    if (!result.rows[0]) return null;
    if (clearCreds) {
      await logisticsConfigRepository.upsert({
        channelConnectionId: String(result.rows[0].id),
        providerType: null,
        credentialsEncrypted: null,
        status: "DISCONNECTED",
      });
      await this.setFulfillmentMethod(channel, null);
    }
    return this.findByChannel(channel);
  }

  async recordSync(channel: ChannelType, syncStatus: string, error: string | null = null) {
    await query(
      `UPDATE channels_config
       SET last_sync_at = NOW(),
           last_sync_status = $2,
           last_error = $3,
           updated_at = NOW()
       WHERE channel = $1`,
      [channel, syncStatus, error]
    );
  }
}

export const channelRepository = new ChannelRepository();
