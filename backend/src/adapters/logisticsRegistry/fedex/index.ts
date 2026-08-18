import { GenericExternalAdapter } from "../base/GenericExternalAdapter.js";
import { defineExternalMeta } from "../types.js";
import type { LogisticsPlugin } from "../plugin.js";

export const fedexPlugin: LogisticsPlugin = {
  meta: defineExternalMeta({
    id: "FEDEX",
    label: "FedEx",
    description: "FedEx Express / Ground — API key + secret.",
    requiredFields: [
      { key: "apiKey", label: "API key" },
      { key: "secretKey", label: "Secret key", type: "password" },
    ],
  }),
  create: () => new GenericExternalAdapter("FEDEX", ["apiKey", "secretKey"]),
};
