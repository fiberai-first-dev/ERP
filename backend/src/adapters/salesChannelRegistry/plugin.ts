import { AdapterCredentials, ChannelAdapter } from "./types.js";
import { ChannelType } from "../../models/domain.js";

export interface SalesChannelPlugin {
  channel: ChannelType;
  Adapter: new (credentials?: AdapterCredentials) => ChannelAdapter;
}
