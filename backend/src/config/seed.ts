import { query } from "./db.js";
import { logger } from "../utils/logger.js";
import { defaultFulfillmentMethodId } from "../adapters/salesChannelRegistry/fulfillmentMethods.js";

/**
 * Ensures channel + logistics_configs rows exist for each sales channel.
 * Seed leaves external logistics null; connect flow sets fulfillment method + optional 3PL.
 */
export async function seed() {
  for (const channel of ["AMAZON", "FLIPKART", "SHOPIFY"] as const) {
    const fulfillmentMethod = defaultFulfillmentMethodId(channel);

    await query(
      `INSERT INTO channels_config (channel, status, credentials, fulfillment_method)
       VALUES ($1, 'DISCONNECTED', '{}'::jsonb, $2)
       ON CONFLICT (channel) DO NOTHING`,
      [channel, fulfillmentMethod]
    );

    const found = await query(`SELECT id FROM channels_config WHERE channel = $1`, [channel]);
    const id = String(found.rows[0].id);

    await query(
      `INSERT INTO logistics_configs (channel_connection_id, provider_type, credentials, status)
       VALUES ($1, NULL, '{}'::jsonb, 'DISCONNECTED')
       ON CONFLICT (channel_connection_id) DO NOTHING`,
      [id]
    );
  }

  logger.info("Seed completed");
}

if (process.argv[1]?.includes("seed")) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
