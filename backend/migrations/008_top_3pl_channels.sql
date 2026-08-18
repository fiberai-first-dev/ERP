-- Expand top 3PL / courier logistics channels
ALTER TABLE channels_config
  DROP CONSTRAINT IF EXISTS channels_logistics_provider_check;

ALTER TABLE channels_config
  ADD CONSTRAINT channels_logistics_provider_check CHECK (
    logistics_provider IS NULL OR logistics_provider IN (
      'AMAZON_EASY_SHIP',
      'FLIPKART_NFBF',
      'SHOPIFY_FULFILLMENT',
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
