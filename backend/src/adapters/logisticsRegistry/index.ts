/**
 * Logistics adapters — one folder per courier / 3PL.
 *
 * Canonical contracts & registry: `src/integrations/logistics`
 *
 * To add a provider:
 * 1. Create logisticsRegistry/<name>/ with Adapter (or GenericExternalAdapter)
 * 2. Export a LogisticsPlugin from index.ts (meta + create)
 * 3. Append the plugin to `plugins` below (single line)
 * Do not modify the fulfillment engine for provider-specific branches.
 *
 * Marketplace-native flows (FBA / NFBF / Easy Ship) belong on sales-channel
 * fulfillment methods — not in this catalog.
 */
import { logisticsRegistry } from "./registry.js";
import type { LogisticsPlugin } from "./plugin.js";

import { delhiveryPlugin } from "./delhivery/index.js";
import { shiprocketPlugin } from "./shiprocket/index.js";
import { bluedartPlugin } from "./bluedart/index.js";
import { ecomExpressPlugin } from "./ecomExpress/index.js";
import { xpressbeesPlugin } from "./xpressbees/index.js";
import { dtdcPlugin } from "./dtdc/index.js";
import { shadowfaxPlugin } from "./shadowfax/index.js";
import { ekartPlugin } from "./ekart/index.js";
import { amazonShippingPlugin } from "./amazonShipping/index.js";
import { gatiPlugin } from "./gati/index.js";
import { fedexPlugin } from "./fedex/index.js";
import { indiaPostPlugin } from "./indiaPost/index.js";
import { blitzPlugin } from "./blitz/index.js";
import { ithinkLogisticsPlugin } from "./ithinkLogistics/index.js";
import { manualCourierPlugin } from "./manualCourier/index.js";

const plugins: LogisticsPlugin[] = [
  delhiveryPlugin,
  shiprocketPlugin,
  bluedartPlugin,
  ecomExpressPlugin,
  xpressbeesPlugin,
  dtdcPlugin,
  shadowfaxPlugin,
  ekartPlugin,
  amazonShippingPlugin,
  gatiPlugin,
  fedexPlugin,
  indiaPostPlugin,
  blitzPlugin,
  ithinkLogisticsPlugin,
  manualCourierPlugin,
];

for (const plugin of plugins) {
  logisticsRegistry.register(plugin);
}

export {
  logisticsRegistry,
  createLogisticsPartner,
  connectLogisticsPartner,
  parseLogisticsCredentials,
} from "./registry.js";

export {
  LOGISTICS_CATALOG,
  EXTERNAL_LOGISTICS_PARTNERS,
  LOGISTICS_PARTNERS,
  MARKETPLACE_LOGISTICS,
  getLogisticsCatalog,
  getExternalLogisticsPartners,
  isLogisticsServiceId,
  isLogisticsPartnerId,
  getLogisticsServiceMeta,
  getLogisticsPartnerMeta,
  marketplaceLogisticsFor,
  logisticsRequiresCredentials,
  registerLogisticsMeta,
} from "./catalog.js";

export * from "./types.js";
export type { LogisticsPlugin } from "./plugin.js";

export * from "./fulfillment/fulfillmentTypes.js";
export * from "./fulfillment/providers.js";
export * from "./fulfillment/credentials.js";
export * from "./fulfillment/notifyMarketplace.js";
