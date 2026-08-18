-- Logistics / 3PL partner for merchant-fulfilled channels
ALTER TABLE channels_config
  ADD COLUMN IF NOT EXISTS logistics_provider TEXT;

ALTER TABLE channels_config
  ADD COLUMN IF NOT EXISTS logistics_credentials JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE channels_config
  DROP CONSTRAINT IF EXISTS channels_logistics_provider_check;

ALTER TABLE channels_config
  ADD CONSTRAINT channels_logistics_provider_check CHECK (
    logistics_provider IS NULL OR logistics_provider IN (
      'SHIPROCKET',
      'DELHIVERY',
      'BLUEDART',
      'ECOM_EXPRESS',
      'XPRESSBEES',
      'DTDC'
    )
  );
