import { BluedartAdapter } from "./BluedartAdapter.js";
import { defineExternalMeta } from "../types.js";
import type { LogisticsPlugin } from "../plugin.js";

export const bluedartPlugin: LogisticsPlugin = {
  meta: defineExternalMeta({
    id: "BLUEDART",
    label: "Blue Dart",
    description: "Premium courier — track with login ID + license key.",
    requiredFields: [
      { key: "loginId", label: "Login ID" },
      { key: "licenseKey", label: "License key", type: "password" },
    ],
  }),
  create: () => new BluedartAdapter(),
};

export { BluedartAdapter };
