import { query } from "../config/db.js";
import {
  LogisticsConfig,
  LogisticsConfigStatus,
  LogisticsPartnerId,
} from "../models/domain.js";
import { isLogisticsPartnerId } from "../adapters/logisticsRegistry/index.js";

function mapRow(row: Record<string, unknown>): LogisticsConfig {
  const providerRaw = row.provider_type ? String(row.provider_type) : null;
  return {
    id: String(row.id),
    channelConnectionId: String(row.channel_connection_id),
    providerType:
      providerRaw && isLogisticsPartnerId(providerRaw)
        ? (providerRaw as LogisticsPartnerId)
        : null,
    credentialsEncrypted:
      row.credentials &&
      typeof row.credentials === "object" &&
      (row.credentials as { enc?: string }).enc
        ? String((row.credentials as { enc: string }).enc)
        : null,
    status: row.status as LogisticsConfigStatus,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export class LogisticsConfigRepository {
  async findByChannelConnectionId(
    channelConnectionId: string
  ): Promise<LogisticsConfig | null> {
    const result = await query(
      `SELECT * FROM logistics_configs WHERE channel_connection_id = $1`,
      [channelConnectionId]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  /**
   * Upsert per-channel logistics.
   * providerType null = marketplace-native method (no external 3PL).
   * credentialsEncrypted: string = set, null = clear, undefined = keep existing on update.
   */
  async upsert(input: {
    channelConnectionId: string;
    providerType: LogisticsPartnerId | null;
    credentialsEncrypted?: string | null;
    status?: LogisticsConfigStatus;
  }): Promise<LogisticsConfig> {
    const clear = input.credentialsEncrypted === null;
    const replace =
      typeof input.credentialsEncrypted === "string" && input.credentialsEncrypted.length > 0;
    const payload = replace
      ? JSON.stringify({ enc: input.credentialsEncrypted })
      : JSON.stringify({});

    await query(
      `INSERT INTO logistics_configs (
         channel_connection_id, provider_type, credentials, status
       )
       VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (channel_connection_id) DO UPDATE SET
         provider_type = EXCLUDED.provider_type,
         credentials = CASE
           WHEN $5 THEN '{}'::jsonb
           WHEN $6 THEN EXCLUDED.credentials
           ELSE logistics_configs.credentials
         END,
         status = EXCLUDED.status,
         updated_at = NOW()`,
      [
        input.channelConnectionId,
        input.providerType,
        payload,
        input.status || "CONNECTED",
        clear,
        replace,
      ]
    );

    const saved = await this.findByChannelConnectionId(input.channelConnectionId);
    if (!saved) throw new Error("Failed to upsert logistics config");
    return saved;
  }

  async deleteByChannelConnectionId(channelConnectionId: string): Promise<void> {
    await query(`DELETE FROM logistics_configs WHERE channel_connection_id = $1`, [
      channelConnectionId,
    ]);
  }
}

export const logisticsConfigRepository = new LogisticsConfigRepository();
