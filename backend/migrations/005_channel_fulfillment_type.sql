-- Per-channel fulfillment / logistics mode
ALTER TABLE channels_config
  ADD COLUMN IF NOT EXISTS fulfillment_type TEXT;

UPDATE channels_config
SET fulfillment_type = CASE channel::text
  WHEN 'SHOPIFY' THEN 'THIRD_PARTY_3PL'
  WHEN 'AMAZON' THEN 'EASY_SHIP'
  WHEN 'FLIPKART' THEN 'NFBF'
  ELSE fulfillment_type
END
WHERE fulfillment_type IS NULL;

ALTER TABLE channels_config
  DROP CONSTRAINT IF EXISTS channels_fulfillment_type_check;

ALTER TABLE channels_config
  ADD CONSTRAINT channels_fulfillment_type_check CHECK (
    fulfillment_type IS NULL OR fulfillment_type IN (
      'THIRD_PARTY_3PL',
      'SHOPIFY_FULFILLMENT',
      'EASY_SHIP',
      'SELF_SHIP',
      'NFBF'
    )
  );
