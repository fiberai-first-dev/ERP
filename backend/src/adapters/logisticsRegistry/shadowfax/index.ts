import { ShadowfaxAdapter } from "./ShadowfaxAdapter.js";
import { defineExternalMeta } from "../types.js";
import type { LogisticsPlugin } from "../plugin.js";

export const shadowfaxPlugin: LogisticsPlugin = {
  meta: defineExternalMeta({
    id: "SHADOWFAX",
    label: "Shadowfax",
    description: "Hyperlocal + ecommerce courier — API token.",
    requiredFields: [{ key: "apiToken", label: "API token", type: "password" }],
  }),
  create: () => new ShadowfaxAdapter(),
};

export { ShadowfaxAdapter };
