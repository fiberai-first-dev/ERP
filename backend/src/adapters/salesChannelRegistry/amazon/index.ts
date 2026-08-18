import { AmazonAdapter } from "./AmazonAdapter.js";
import type { SalesChannelPlugin } from "../plugin.js";

export const amazonPlugin: SalesChannelPlugin = {
  channel: "AMAZON",
  Adapter: AmazonAdapter,
};

export { AmazonAdapter };
