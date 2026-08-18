import { DelhiveryAdapter } from "./DelhiveryAdapter.js";
import { defineExternalMeta } from "../types.js";
import type { LogisticsPlugin } from "../plugin.js";

export const delhiveryPlugin: LogisticsPlugin = {
  meta: defineExternalMeta({
    id: "DELHIVERY",
    label: "Delhivery",
    description: "India’s largest ecommerce courier — create shipment, label, pickup, track.",
    requiredFields: [{ key: "apiToken", label: "API token", type: "password" }],
  }),
  create: () => new DelhiveryAdapter(),
};

export { DelhiveryAdapter };
