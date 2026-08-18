import { GenericExternalAdapter } from "../base/GenericExternalAdapter.js";
import { defineExternalMeta } from "../types.js";
import type { LogisticsPlugin } from "../plugin.js";

export const gatiPlugin: LogisticsPlugin = {
  meta: defineExternalMeta({
    id: "GATI",
    label: "Gati",
    description: "Gati (Allcargo) express logistics — API key.",
    requiredFields: [{ key: "apiKey", label: "API key", type: "password" }],
  }),
  create: () => new GenericExternalAdapter("GATI", ["apiKey"]),
};
