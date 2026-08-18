import { XpressbeesAdapter } from "./XpressbeesAdapter.js";
import { defineExternalMeta } from "../types.js";
import type { LogisticsPlugin } from "../plugin.js";

export const xpressbeesPlugin: LogisticsPlugin = {
  meta: defineExternalMeta({
    id: "XPRESSBEES",
    label: "Xpressbees",
    description: "High-volume ecommerce logistics — API email / password.",
    requiredFields: [
      { key: "email", label: "API email" },
      { key: "password", label: "API password", type: "password" },
    ],
  }),
  create: () => new XpressbeesAdapter(),
};

export { XpressbeesAdapter };
