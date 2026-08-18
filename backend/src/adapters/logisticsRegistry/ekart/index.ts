import { EkartAdapter } from "./EkartAdapter.js";
import { defineExternalMeta } from "../types.js";
import type { LogisticsPlugin } from "../plugin.js";

export const ekartPlugin: LogisticsPlugin = {
  meta: defineExternalMeta({
    id: "EKART",
    label: "Ekart",
    description: "Flipkart Ekart logistics — API token.",
    requiredFields: [{ key: "apiToken", label: "API token", type: "password" }],
  }),
  create: () => new EkartAdapter(),
};

export { EkartAdapter };
