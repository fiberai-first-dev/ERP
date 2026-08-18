/**
 * Channel-specific fulfillment methods.
 * FBA / FBF / Easy Ship / NFBF live here — never in the generic logistics catalog.
 */

export interface FulfillmentMethodCapabilities {
  shipmentCreation?: boolean;
  labelGeneration?: boolean;
  pickupScheduling?: boolean;
  tracking?: boolean;
}

export interface FulfillmentMethodDefinition {
  id: string;
  name: string;
  /** When true, Settings must collect an external logistics provider. */
  requiresLogisticsProvider: boolean;
  /**
   * Internal/native logistics owner for marketplace-managed methods.
   * Not a selectable logistics catalog entry (e.g. "AMAZON", "FLIPKART").
   */
  defaultLogisticsProvider?: string;
  description?: string;
  capabilities?: FulfillmentMethodCapabilities;
}

export const AMAZON_FULFILLMENT_METHODS: FulfillmentMethodDefinition[] = [
  {
    id: "FBA",
    name: "FBA",
    requiresLogisticsProvider: false,
    defaultLogisticsProvider: "AMAZON",
    description: "Fulfilled by Amazon — Amazon owns inventory and logistics.",
    capabilities: { tracking: true },
  },
  {
    id: "EASY_SHIP",
    name: "Easy Ship",
    requiresLogisticsProvider: false,
    defaultLogisticsProvider: "AMAZON",
    description: "Seller packs; Amazon pickup and delivery.",
    capabilities: {
      shipmentCreation: true,
      labelGeneration: true,
      pickupScheduling: true,
      tracking: true,
    },
  },
  {
    id: "SELF_SHIP",
    name: "Self Ship",
    requiresLogisticsProvider: true,
    description: "Seller ships with an external courier / aggregator.",
    capabilities: {
      shipmentCreation: true,
      labelGeneration: true,
      pickupScheduling: true,
      tracking: true,
    },
  },
];

export const FLIPKART_FULFILLMENT_METHODS: FulfillmentMethodDefinition[] = [
  {
    id: "FBF",
    name: "FBF",
    requiresLogisticsProvider: false,
    defaultLogisticsProvider: "FLIPKART",
    description: "Fulfilled by Flipkart.",
    capabilities: { tracking: true },
  },
  {
    id: "NFBF",
    name: "NFBF",
    requiresLogisticsProvider: false,
    defaultLogisticsProvider: "FLIPKART",
    description: "Seller packs; Flipkart logistics workflow.",
    capabilities: {
      shipmentCreation: true,
      labelGeneration: true,
      pickupScheduling: true,
      tracking: true,
    },
  },
  {
    id: "SELF_SHIP",
    name: "Self Ship",
    requiresLogisticsProvider: true,
    description: "Seller ships with an external courier / aggregator.",
    capabilities: {
      shipmentCreation: true,
      labelGeneration: true,
      pickupScheduling: true,
      tracking: true,
    },
  },
];

export const SHOPIFY_FULFILLMENT_METHODS: FulfillmentMethodDefinition[] = [
  {
    id: "SELF_SHIP",
    name: "Self Ship",
    requiresLogisticsProvider: true,
    description: "Merchant fulfills and ships with a logistics partner.",
    capabilities: {
      shipmentCreation: true,
      labelGeneration: true,
      pickupScheduling: true,
      tracking: true,
    },
  },
];

const BY_CHANNEL: Record<string, FulfillmentMethodDefinition[]> = {
  AMAZON: AMAZON_FULFILLMENT_METHODS,
  FLIPKART: FLIPKART_FULFILLMENT_METHODS,
  SHOPIFY: SHOPIFY_FULFILLMENT_METHODS,
};

export function fulfillmentMethodsFor(channel: string): FulfillmentMethodDefinition[] {
  return BY_CHANNEL[String(channel).toUpperCase()] || [];
}

export function getFulfillmentMethod(
  channel: string,
  methodId: string | null | undefined
): FulfillmentMethodDefinition | null {
  if (!methodId) return null;
  const id = String(methodId).toUpperCase();
  // Legacy Shopify alias — third-party was collapsed into Self Ship.
  const normalized =
    String(channel).toUpperCase() === "SHOPIFY" && id === "THIRD_PARTY"
      ? "SELF_SHIP"
      : id;
  return (
    fulfillmentMethodsFor(channel).find((m) => m.id === normalized || m.id === methodId) ||
    null
  );
}

export function defaultFulfillmentMethodId(channel: string): string {
  const methods = fulfillmentMethodsFor(channel);
  const selfShip = methods.find((m) => m.id === "SELF_SHIP");
  return (selfShip || methods[0])?.id || "SELF_SHIP";
}

/** Migrate legacy marketplace-as-provider_type values into fulfillment methods. */
export function migrateLegacyProviderToFulfillmentMethod(
  channel: string,
  providerType: string | null | undefined
): { fulfillmentMethod: string; keepExternalProvider: boolean } {
  const p = String(providerType || "").toUpperCase();
  const ch = String(channel).toUpperCase();
  if (p === "AMAZON" || (ch === "AMAZON" && !p)) {
    return { fulfillmentMethod: "EASY_SHIP", keepExternalProvider: false };
  }
  if (p === "FLIPKART" || (ch === "FLIPKART" && !p)) {
    return { fulfillmentMethod: "NFBF", keepExternalProvider: false };
  }
  if (p === "SHOPIFY") {
    return { fulfillmentMethod: "SELF_SHIP", keepExternalProvider: false };
  }
  if (p && !["AMAZON", "FLIPKART", "SHOPIFY"].includes(p)) {
    return { fulfillmentMethod: "SELF_SHIP", keepExternalProvider: true };
  }
  return {
    fulfillmentMethod: defaultFulfillmentMethodId(channel),
    keepExternalProvider: false,
  };
}
