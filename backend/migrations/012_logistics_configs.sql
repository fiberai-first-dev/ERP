-- Per-channel logistics config (mirrors channels_config pattern).
-- Replaces shared logistics_connections + channel_fulfillment_configs join.

CREATE TABLE IF NOT EXISTS logistics_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_connection_id UUID NOT NULL UNIQUE REFERENCES channels_config(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'CONNECTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT logistics_configs_status_check CHECK (
    status IN ('CONNECTED', 'DISCONNECTED', 'ERROR')
  ),
  CONSTRAINT logistics_configs_provider_check CHECK (
    provider_type IN (
      'AMAZON',
      'FLIPKART',
      'SHOPIFY',
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

CREATE INDEX IF NOT EXISTS idx_logistics_configs_provider
  ON logistics_configs (provider_type);

DO $$
BEGIN
  IF to_regclass('public.channel_fulfillment_configs') IS NOT NULL
     AND to_regclass('public.logistics_connections') IS NOT NULL THEN
    INSERT INTO logistics_configs (
      channel_connection_id,
      provider_type,
      credentials,
      status,
      created_at,
      updated_at
    )
    SELECT
      cfc.channel_connection_id,
      COALESCE(lc.provider_type, CASE cc.channel
        WHEN 'AMAZON' THEN 'AMAZON'
        WHEN 'FLIPKART' THEN 'FLIPKART'
        ELSE 'MANUAL_COURIER'
      END),
      COALESCE(lc.credentials, '{}'::jsonb),
      COALESCE(lc.status, 'CONNECTED'),
      COALESCE(lc.created_at, cfc.created_at),
      NOW()
    FROM channel_fulfillment_configs cfc
    JOIN channels_config cc ON cc.id = cfc.channel_connection_id
    LEFT JOIN logistics_connections lc ON lc.id = cfc.logistics_connection_id
    ON CONFLICT (channel_connection_id) DO NOTHING;
  ELSIF to_regclass('public.channel_fulfillment_configs') IS NOT NULL THEN
    INSERT INTO logistics_configs (
      channel_connection_id,
      provider_type,
      credentials,
      status,
      created_at,
      updated_at
    )
    SELECT
      cfc.channel_connection_id,
      CASE cc.channel
        WHEN 'AMAZON' THEN 'AMAZON'
        WHEN 'FLIPKART' THEN 'FLIPKART'
        ELSE 'MANUAL_COURIER'
      END,
      '{}'::jsonb,
      'CONNECTED',
      cfc.created_at,
      NOW()
    FROM channel_fulfillment_configs cfc
    JOIN channels_config cc ON cc.id = cfc.channel_connection_id
    ON CONFLICT (channel_connection_id) DO NOTHING;
  END IF;
END $$;

INSERT INTO logistics_configs (channel_connection_id, provider_type, credentials, status)
SELECT
  cc.id,
  CASE cc.channel
    WHEN 'AMAZON' THEN 'AMAZON'
    WHEN 'FLIPKART' THEN 'FLIPKART'
    ELSE 'MANUAL_COURIER'
  END,
  '{}'::jsonb,
  'CONNECTED'
FROM channels_config cc
WHERE NOT EXISTS (
  SELECT 1 FROM logistics_configs lc WHERE lc.channel_connection_id = cc.id
)
ON CONFLICT (channel_connection_id) DO NOTHING;

DROP TABLE IF EXISTS channel_fulfillment_configs;
DROP TABLE IF EXISTS logistics_connections;
