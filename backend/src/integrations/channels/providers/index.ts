import { CHANNEL_CREDENTIAL_META } from "../../../adapters/salesChannelRegistry/credentialSchemas.js";
import { AmazonAdapter } from "../../../adapters/salesChannelRegistry/amazon/AmazonAdapter.js";
import { FlipkartAdapter } from "../../../adapters/salesChannelRegistry/flipkart/FlipkartAdapter.js";
import { ShopifyAdapter } from "../../../adapters/salesChannelRegistry/shopify/ShopifyAdapter.js";
import type { ChannelPlugin } from "../registry.js";
import type { CredentialField } from "../core/types.js";

function schemaFor(channel: "AMAZON" | "FLIPKART" | "SHOPIFY"): CredentialField[] {
  return CHANNEL_CREDENTIAL_META[channel].map((f) => ({
    name: f.key,
    label: f.label,
    type: f.type === "password" ? "password" : "text",
    required: true,
  }));
}

export const amazonChannelPlugin: ChannelPlugin = {
  definition: {
    id: "AMAZON",
    name: "Amazon",
    category: "CHANNEL",
    description: "Amazon Seller Partner API — orders, inventory, self-ship tracking.",
    capabilities: {
      inventory: true,
      orders: true,
      fulfillment: true,
      tracking: true,
      webhooks: true,
      notifySelfShip: true,
      createTestOrder: false,
      sandboxLifecycle: false,
    },
    credentialSchema: schemaFor("AMAZON"),
  },
  legacyFactory: (credentials) => new AmazonAdapter(credentials),
};

export const flipkartChannelPlugin: ChannelPlugin = {
  definition: {
    id: "FLIPKART",
    name: "Flipkart",
    category: "CHANNEL",
    description: "Flipkart Seller API — orders, inventory, self-ship tracking.",
    capabilities: {
      inventory: true,
      orders: true,
      fulfillment: true,
      tracking: true,
      webhooks: true,
      notifySelfShip: true,
      createTestOrder: false,
      sandboxLifecycle: true,
    },
    credentialSchema: schemaFor("FLIPKART"),
  },
  legacyFactory: (credentials) => new FlipkartAdapter(credentials),
};

export const shopifyChannelPlugin: ChannelPlugin = {
  definition: {
    id: "SHOPIFY",
    name: "Shopify",
    category: "CHANNEL",
    description: "Shopify Admin API — catalog, orders, fulfillments.",
    capabilities: {
      inventory: true,
      orders: true,
      fulfillment: true,
      tracking: true,
      webhooks: true,
      notifySelfShip: false,
      createTestOrder: true,
      sandboxLifecycle: false,
    },
    credentialSchema: schemaFor("SHOPIFY").map((f) =>
      f.name === "shopDomain" ? { ...f, required: true } : f
    ),
  },
  legacyFactory: (credentials) => new ShopifyAdapter(credentials),
};

export const channelProviderPlugins: ChannelPlugin[] = [
  amazonChannelPlugin,
  flipkartChannelPlugin,
  shopifyChannelPlugin,
];
