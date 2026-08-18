import { ChannelType } from "../../models/domain.js";
import {
  AdapterCredentials,
  ChannelAdapter,
  type SalesChannelAdapter,
} from "./types.js";
import { AppError } from "../../middleware/errorHandler.js";

type AdapterCtor = new (credentials?: AdapterCredentials) => ChannelAdapter;

/**
 * Plug-and-play sales channel registry.
 * Adding a channel: create folder under salesChannelRegistry/<name>/ and register here.
 */
export class SalesChannelRegistry {
  private adapters = new Map<ChannelType, AdapterCtor>();

  register(channel: ChannelType, ctor: AdapterCtor) {
    this.adapters.set(channel, ctor);
  }

  create(channel: ChannelType, credentials: AdapterCredentials = {}): SalesChannelAdapter {
    const Ctor = this.adapters.get(channel);
    if (!Ctor) throw new AppError(`Unsupported sales channel: ${channel}`, 400);
    return new Ctor(credentials);
  }

  has(channel: ChannelType) {
    return this.adapters.has(channel);
  }

  list(): ChannelType[] {
    return [...this.adapters.keys()];
  }
}

export const salesChannelRegistry = new SalesChannelRegistry();

/** @deprecated use salesChannelRegistry.create */
export function createAdapter(
  channel: ChannelType,
  credentials: AdapterCredentials = {}
): ChannelAdapter {
  return salesChannelRegistry.create(channel, credentials);
}

/** @deprecated use salesChannelRegistry.list */
export function listRegisteredChannels(): ChannelType[] {
  return salesChannelRegistry.list();
}

/** @deprecated use salesChannelRegistry.register */
export function registerAdapter(channel: ChannelType, ctor: AdapterCtor) {
  salesChannelRegistry.register(channel, ctor);
}
