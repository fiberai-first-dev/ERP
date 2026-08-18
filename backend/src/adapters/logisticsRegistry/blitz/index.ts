import { GenericExternalAdapter } from "../base/GenericExternalAdapter.js";
import { defineExternalMeta } from "../types.js";
import type { LogisticsPlugin } from "../plugin.js";

export const blitzPlugin: LogisticsPlugin = {
  meta: defineExternalMeta({
    id: "BLITZ",
    label: "Blitz",
    description: "Blitz ecommerce logistics — API token.",
    requiredFields: [{ key: "apiToken", label: "API token", type: "password" }],
  }),
  create: () => new GenericExternalAdapter("BLITZ", ["apiToken"]),
};
