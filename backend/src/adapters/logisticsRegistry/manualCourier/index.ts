import { ManualCourierAdapter } from "./ManualCourierAdapter.js";
import { defineExternalMeta } from "../types.js";
import type { LogisticsPlugin } from "../plugin.js";

export const manualCourierPlugin: LogisticsPlugin = {
  meta: defineExternalMeta({
    id: "MANUAL_COURIER",
    label: "Manual courier",
    description: "Record AWB and tracking without a courier API.",
    requiredFields: [],
    capabilities: {
      createShipment: true,
      schedulePickup: true,
      generateLabel: true,
      tracking: false,
      cancelShipment: true,
    },
  }),
  create: () => new ManualCourierAdapter(),
};

export { ManualCourierAdapter };
