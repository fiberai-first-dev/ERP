import { GenericExternalAdapter } from "../base/GenericExternalAdapter.js";
import { defineExternalMeta } from "../types.js";
import type { LogisticsPlugin } from "../plugin.js";

export const indiaPostPlugin: LogisticsPlugin = {
  meta: defineExternalMeta({
    id: "INDIA_POST",
    label: "India Post",
    description: "India Post and Speed Post.",
    requiredFields: [],
  }),
  create: () => new GenericExternalAdapter("INDIA_POST", []),
};
