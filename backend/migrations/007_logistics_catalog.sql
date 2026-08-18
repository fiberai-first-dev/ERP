-- Widen logistics_provider for marketplace + extra 3PLs
ALTER TABLE channels_config
  DROP CONSTRAINT IF EXISTS channels_logistics_provider_check;

ALTER TABLE channels_config
  ADD CONSTRAINT channels_logistics_provider_check CHECK (
    logistics_provider IS NULL OR logistics_provider IN (
      -- Marketplace-owned logistics (ecommerce is the logistics channel)
      'AMAZON_EASY_SHIP',
      'FLIPKART_NFBF',
      'SHOPIFY_FULFILLMENT',
      -- External 3PL / courier platforms
      'SHIPROCKET',
      'DELHIVERY',
      'BLUEDART',
      'ECOM_EXPRESS',
      'XPRESSBEES',
      'DTDC',
      'SHADOWFAX',
      'EKART',
      'MANUAL_COURIER'
    )
  );
