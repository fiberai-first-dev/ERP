-- Drop fulfillment_type; logistics provider alone decides who ships.
-- Marketplace logistics use AMAZON / FLIPKART / SHOPIFY as provider_type on logistics_connections.

ALTER TABLE logistics_connections
  DROP CONSTRAINT IF EXISTS logistics_connections_provider_check;

-- Remap legacy marketplace ids if any landed in logistics_connections
UPDATE logistics_connections SET provider_type = 'AMAZON'
WHERE provider_type IN ('AMAZON_EASY_SHIP', 'AMAZON_FULFILLMENT', 'FBA');

UPDATE logistics_connections SET provider_type = 'FLIPKART'
WHERE provider_type IN ('FLIPKART_NFBF', 'NFBF');

UPDATE logistics_connections SET provider_type = 'SHOPIFY'
WHERE provider_type IN ('SHOPIFY_FULFILLMENT');

ALTER TABLE logistics_connections
  ADD CONSTRAINT logistics_connections_provider_check CHECK (
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
  );

-- For channels still on marketplace fulfillment without a logistics connection, create one.
DO $$
DECLARE
  r RECORD;
  new_id UUID;
  provider TEXT;
BEGIN
  FOR r IN
    SELECT cfc.id AS cfc_id,
           cfc.channel_connection_id,
           cfc.fulfillment_type,
           cfc.logistics_connection_id,
           cc.channel
    FROM channel_fulfillment_configs cfc
    JOIN channels_config cc ON cc.id = cfc.channel_connection_id
    WHERE cfc.logistics_connection_id IS NULL
  LOOP
    provider := CASE
      WHEN r.fulfillment_type IN ('EASY_SHIP', 'FBA', 'SHOPIFY_FULFILLMENT', 'NFBF')
        OR r.fulfillment_type IS NULL THEN
          CASE r.channel
            WHEN 'AMAZON' THEN 'AMAZON'
            WHEN 'FLIPKART' THEN 'FLIPKART'
            WHEN 'SHOPIFY' THEN 'DELHIVERY'
            ELSE 'MANUAL_COURIER'
          END
      WHEN r.fulfillment_type IN ('SELF_SHIP', 'THIRD_PARTY_3PL') THEN 'MANUAL_COURIER'
      ELSE
        CASE r.channel
          WHEN 'AMAZON' THEN 'AMAZON'
          WHEN 'FLIPKART' THEN 'FLIPKART'
          ELSE 'MANUAL_COURIER'
        END
    END;

    INSERT INTO logistics_connections (provider_type, credentials, status, label)
    VALUES (provider, '{}'::jsonb, 'CONNECTED', provider)
    RETURNING id INTO new_id;

    UPDATE channel_fulfillment_configs
    SET logistics_connection_id = new_id, updated_at = NOW()
    WHERE id = r.cfc_id;
  END LOOP;
END $$;

ALTER TABLE channel_fulfillment_configs
  DROP CONSTRAINT IF EXISTS channel_fulfillment_configs_type_check;

ALTER TABLE channel_fulfillment_configs
  DROP COLUMN IF EXISTS fulfillment_type;

-- Require a logistics link going forward (nullable kept for mid-migration safety; enforced in service)
