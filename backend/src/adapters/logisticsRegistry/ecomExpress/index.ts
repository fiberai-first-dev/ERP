import { EcomExpressAdapter } from "./EcomExpressAdapter.js";
import { defineExternalMeta } from "../types.js";
import type { LogisticsPlugin } from "../plugin.js";

export const ecomExpressPlugin: LogisticsPlugin = {
  meta: defineExternalMeta({
    id: "ECOM_EXPRESS",
    label: "Ecom Express",
    description: "Major ecommerce-focused courier — username / password.",
    requiredFields: [
      { key: "username", label: "Username" },
      { key: "password", label: "Password", type: "password" },
    ],
  }),
  create: () => new EcomExpressAdapter(),
};

export { EcomExpressAdapter };
