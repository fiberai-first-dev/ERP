import { ShiprocketAdapter } from "./ShiprocketAdapter.js";
import { defineExternalMeta } from "../types.js";
import type { LogisticsPlugin } from "../plugin.js";

export const shiprocketPlugin: LogisticsPlugin = {
  meta: defineExternalMeta({
    id: "SHIPROCKET",
    label: "Shiprocket",
    description: "Leading logistics aggregator — AWB, label, pickup via Shiprocket API.",
    requiredFields: [
      { key: "email", label: "API email" },
      { key: "password", label: "API password", type: "password" },
    ],
  }),
  create: () => new ShiprocketAdapter(),
};

export { ShiprocketAdapter };
