import { ChannelType } from "../../../models/domain.js";
import {
  getLogisticsCatalog,
  type LogisticsServiceId,
  type LogisticsServiceMeta,
} from "../catalog.js";
import { logisticsSupportsChannel } from "../types.js";

/**
 * External logistics choices for a sales channel (Self Ship / 3PL).
 * Marketplace-native methods (FBA, NFBF, Easy Ship) do not use this list.
 */
export function availableLogisticsFor(channel: ChannelType): LogisticsServiceMeta[] {
  return getLogisticsCatalog().filter((m) => logisticsSupportsChannel(m, channel));
}

/** Default external courier when fulfillment method requires logistics. */
export function defaultLogisticsProvider(_channel: ChannelType): LogisticsServiceId {
  const available = availableLogisticsFor(_channel);
  return (available.find((m) => m.id === "DELHIVERY") || available[0])?.id || "MANUAL_COURIER";
}

/** @deprecated Marketplace providers are no longer in the logistics catalog. */
export function marketplaceProviderFor(_channel: ChannelType): LogisticsServiceId | null {
  return null;
}

/** @deprecated Prefer fulfillment method `requiresLogisticsProvider === false`. */
export function isMarketplaceLogisticsProvider(_provider: string | null | undefined): boolean {
  return false;
}

/** True when the channel method uses sales-channel fulfillment (no external 3PL). */
export function isChannelNativeFulfillmentMethod(
  channel: ChannelType | string,
  fulfillmentMethod: string | null | undefined
): boolean {
  // Lazy import path avoided — callers should use fulfillmentMethods helpers.
  const id = String(fulfillmentMethod || "").toUpperCase();
  if (["FBA", "EASY_SHIP", "FBF", "NFBF"].includes(id)) return true;
  if (!id) {
    const ch = String(channel).toUpperCase();
    return ch === "AMAZON" || ch === "FLIPKART";
  }
  return false;
}

export function isExternalLogisticsProvider(provider: string | null | undefined): boolean {
  if (!provider) return false;
  return availableLogisticsFor("SHOPIFY").some((p) => p.id === provider)
    || getLogisticsCatalog().some((p) => p.id === provider);
}

/** @deprecated */
export function isMarketplaceLogistics(providerOrLegacy?: string | null) {
  return isMarketplaceLogisticsProvider(providerOrLegacy);
}

/** @deprecated */
export function isThirdPartyLogistics(providerOrLegacy?: string | null) {
  return isExternalLogisticsProvider(providerOrLegacy);
}

/** Fixed Shopify buyer for simulation orders (matches live customer profile). */
export const SHOPIFY_SIM_CUSTOMER = {
  name: "Moola Jagadeshwar Reddy",
  email: "jjagadesh980@gmail.com",
  phone: "6303481401",
  address: "12 MG Road, Bengaluru, Karnataka 560001, India",
} as const;
