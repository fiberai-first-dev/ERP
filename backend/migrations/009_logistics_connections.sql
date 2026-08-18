-- Separate logistics connections from sales-channel rows.
-- Per-channel fulfillment config links a channel to (optional) logistics connection.

CREATE TABLE IF NOT EXISTS logistics_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'CONNECTED'
    CHECK (status IN ('CONNECTED', 'DISCONNECTED', 'ERROR')),
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT logistics_connections_provider_check CHECK (
    provider_type IN (
      'DELHIVERY',
      'BLUEDART',
      'SHIPROCKET',
      'ECOM_EXPRESS',
      'XPRESSBEES',
      'DTDC',
      'SHADOWFAX',
      'EKART',
      'AMAZON_SHIPPING',
      'GATI',
      'FEDEX',
      'INDIA_POST',
      'BLITZ',
      'ITHINK_LOGISTICS',
      'MANUAL_COURIER'
    )
  )
);

CREATE TABLE IF NOT EXISTS channel_fulfillment_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_connection_id UUID NOT NULL UNIQUE REFERENCES channels_config(id) ON DELETE CASCADE,
  fulfillment_type TEXT NOT NULL,
  logistics_connection_id UUID REFERENCES logistics_connections(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT channel_fulfillment_configs_type_check CHECK (
    fulfillment_type IN (
      'THIRD_PARTY_3PL',
      'SHOPIFY_FULFILLMENT',
      'EASY_SHIP',
      'SELF_SHIP',
      'NFBF',
      'FBA'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_channel_fulfillment_configs_logistics
  ON channel_fulfillment_configs (logistics_connection_id);

-- Migrate existing per-channel logistics into reusable connections + fulfillment configs.
DO $$
DECLARE
  r RECORD;
  new_connection_id UUID;
  resolved_type TEXT;
  provider TEXT;
BEGIN
  FOR r IN
    SELECT id, channel, fulfillment_type, logistics_provider, logistics_credentials
    FROM channels_config
  LOOP
    resolved_type := COALESCE(r.fulfillment_type,
      CASE r.channel
        WHEN 'SHOPIFY' THEN 'THIRD_PARTY_3PL'
        WHEN 'AMAZON' THEN 'EASY_SHIP'
        WHEN 'FLIPKART' THEN 'NFBF'
        ELSE 'SELF_SHIP'
      END
    );

    new_connection_id := NULL;
    provider := r.logistics_provider;

    -- Only external 3PLs become logistics_connections rows.
    IF provider IS NOT NULL AND provider IN (
      'DELHIVERY', 'BLUEDART', 'SHIPROCKET', 'ECOM_EXPRESS', 'XPRESSBEES',
      'DTDC', 'SHADOWFAX', 'EKART', 'AMAZON_SHIPPING', 'GATI', 'FEDEX',
      'INDIA_POST', 'BLITZ', 'ITHINK_LOGISTICS', 'MANUAL_COURIER'
    ) AND resolved_type IN ('THIRD_PARTY_3PL', 'SELF_SHIP') THEN
      INSERT INTO logistics_connections (provider_type, credentials, status, label)
      VALUES (
        provider,
        COALESCE(r.logistics_credentials, '{}'::jsonb),
        'CONNECTED',
        provider
      )
      RETURNING id INTO new_connection_id;
    END IF;

    INSERT INTO channel_fulfillment_configs (
      channel_connection_id, fulfillment_type, logistics_connection_id
    )
    VALUES (r.id, resolved_type, new_connection_id)
    ON CONFLICT (channel_connection_id) DO UPDATE SET
      fulfillment_type = EXCLUDED.fulfillment_type,
      logistics_connection_id = COALESCE(
        EXCLUDED.logistics_connection_id,
        channel_fulfillment_configs.logistics_connection_id
      ),
      updated_at = NOW();
  END LOOP;
END $$;

ALTER TABLE channels_config DROP CONSTRAINT IF EXISTS channels_fulfillment_type_check;
ALTER TABLE channels_config DROP CONSTRAINT IF EXISTS channels_logistics_provider_check;

ALTER TABLE channels_config DROP COLUMN IF EXISTS fulfillment_type;
ALTER TABLE channels_config DROP COLUMN IF EXISTS logistics_provider;
ALTER TABLE channels_config DROP COLUMN IF EXISTS logistics_credentials;
