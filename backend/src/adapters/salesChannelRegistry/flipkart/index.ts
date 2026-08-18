import { FlipkartAdapter } from "./FlipkartAdapter.js";
import type { SalesChannelPlugin } from "../plugin.js";

export const flipkartPlugin: SalesChannelPlugin = {
  channel: "FLIPKART",
  Adapter: FlipkartAdapter,
};

export { FlipkartAdapter };
