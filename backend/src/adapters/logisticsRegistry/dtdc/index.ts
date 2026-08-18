import { DtdcAdapter } from "./DtdcAdapter.js";
import { defineExternalMeta } from "../types.js";
import type { LogisticsPlugin } from "../plugin.js";

export const dtdcPlugin: LogisticsPlugin = {
  meta: defineExternalMeta({
    id: "DTDC",
    label: "DTDC",
    description: "Nationwide courier — customer code + API key.",
    requiredFields: [
      { key: "customerCode", label: "Customer code" },
      { key: "apiKey", label: "API key", type: "password" },
    ],
  }),
  create: () => new DtdcAdapter(),
};

export { DtdcAdapter };
