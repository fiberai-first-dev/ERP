import { GenericExternalAdapter } from "../base/GenericExternalAdapter.js";
import { defineExternalMeta } from "../types.js";
import type { LogisticsPlugin } from "../plugin.js";

export const ithinkLogisticsPlugin: LogisticsPlugin = {
  meta: defineExternalMeta({
    id: "ITHINK_LOGISTICS",
    label: "iThink Logistics",
    description: "Multi-carrier aggregator — access / secret token.",
    requiredFields: [
      { key: "accessToken", label: "Access token", type: "password" },
      { key: "secretToken", label: "Secret token", type: "password" },
    ],
  }),
  create: () => new GenericExternalAdapter("ITHINK_LOGISTICS", ["accessToken", "secretToken"]),
};
