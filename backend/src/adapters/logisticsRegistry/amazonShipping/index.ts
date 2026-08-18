import { GenericExternalAdapter } from "../base/GenericExternalAdapter.js";
import { defineExternalMeta } from "../types.js";
import type { LogisticsPlugin } from "../plugin.js";

/**
 * Amazon Buy Shipping / Merchant Fulfillment for Amazon marketplace Self Ship.
 * Not multi-channel: Flipkart/Shopify Self Ship should use independent couriers
 * (Delhivery, Shiprocket, …). Off-Amazon Amazon Shipping Partner API / MCF are
 * out of scope until explicitly productized.
 */
export const amazonShippingPlugin: LogisticsPlugin = {
  meta: defineExternalMeta({
    id: "AMAZON_SHIPPING",
    label: "Amazon Shipping",
    description: "Amazon Buy Shipping for Amazon marketplace Self Ship orders.",
    supportedChannels: ["AMAZON"],
    requiredFields: [
      { key: "clientId", label: "Client ID" },
      { key: "clientSecret", label: "Client secret", type: "password" },
      { key: "refreshToken", label: "Refresh token", type: "password" },
    ],
  }),
  create: () =>
    new GenericExternalAdapter("AMAZON_SHIPPING", ["clientId", "clientSecret", "refreshToken"]),
};
