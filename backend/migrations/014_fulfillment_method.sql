-- Channel → Fulfillment Method → Optional external logistics provider

ALTER TABLE channels_config
  ADD COLUMN IF NOT EXISTS fulfillment_method TEXT;

-- Allow NULL external logistics when method is marketplace-native (FBA, NFBF, …)
ALTER TABLE logistics_configs
  ALTER COLUMN provider_type DROP NOT NULL;

-- Drop old check (may allow AMAZON/FLIPKART/SHOPIFY) before rewriting data
ALTER TABLE logistics_configs
  DROP CONSTRAINT IF EXISTS logistics_configs_provider_check;

-- Backfill fulfillment_method from previous marketplace-as-logistics model
UPDATE channels_config cc
SET fulfillment_method = CASE
  WHEN lc.provider_type = 'AMAZON' THEN 'EASY_SHIP'
  WHEN lc.provider_type = 'FLIPKART' THEN 'NFBF'
  WHEN lc.provider_type = 'SHOPIFY' THEN 'SELF_SHIP'
  WHEN lc.provider_type IS NOT NULL
       AND lc.provider_type NOT IN ('AMAZON', 'FLIPKART', 'SHOPIFY') THEN 'SELF_SHIP'
  WHEN cc.channel = 'AMAZON' THEN 'EASY_SHIP'
  WHEN cc.channel = 'FLIPKART' THEN 'NFBF'
  ELSE 'SELF_SHIP'
END
FROM logistics_configs lc
WHERE lc.channel_connection_id = cc.id
  AND (cc.fulfillment_method IS NULL OR cc.fulfillment_method = '');

UPDATE channels_config
SET fulfillment_method = CASE channel
  WHEN 'AMAZON' THEN 'EASY_SHIP'
  WHEN 'FLIPKART' THEN 'NFBF'
  ELSE 'SELF_SHIP'
END
WHERE fulfillment_method IS NULL OR fulfillment_method = '';

-- Clear marketplace ids from logistics provider column BEFORE new CHECK
UPDATE logistics_configs
SET provider_type = NULL,
    credentials = '{}'::jsonb,
    updated_at = NOW()
WHERE provider_type IN ('AMAZON', 'FLIPKART', 'SHOPIFY');

-- Also null any other unknown legacy values that would violate the new check
UPDATE logistics_configs
SET provider_type = NULL,
    credentials = '{}'::jsonb,
    updated_at = NOW()
WHERE provider_type IS NOT NULL
  AND provider_type NOT IN (
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
  );

ALTER TABLE logistics_configs
  ADD CONSTRAINT logistics_configs_provider_check CHECK (
    provider_type IS NULL OR provider_type IN (
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
  );
