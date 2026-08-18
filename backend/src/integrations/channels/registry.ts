import { AppError } from "../../middleware/errorHandler.js";
import type { SalesChannelAdapter } from "./core/adapter.js";
import type { ChannelIntegrationDefinition } from "./core/capabilities.js";
import type { ChannelCredentials, SalesChannelId } from "./core/types.js";
import type { LegacyChannelFactory } from "./core/legacyBridge.js";
import { LegacySalesChannelBridge } from "./core/legacyBridge.js";

export interface ChannelPlugin {
  definition: ChannelIntegrationDefinition;
  /** Preferred: factory returning canonical adapter */
  create?: (credentials?: ChannelCredentials) => SalesChannelAdapter;
  /** Transition: wrap legacy ChannelAdapter ctor */
  legacyFactory?: LegacyChannelFactory;
}

/**
 * Canonical sales-channel registry.
 * Adding a channel = implement adapter + register plugin (no core engine changes).
 */
export class ChannelRegistry {
  private readonly plugins = new Map<SalesChannelId, ChannelPlugin>();

  register(plugin: ChannelPlugin) {
    const id = plugin.definition.id;
    if (this.plugins.has(id)) {
      throw new Error(`Channel plugin already registered: ${id}`);
    }
    if (!plugin.create && !plugin.legacyFactory) {
      throw new Error(`Channel plugin ${id} must provide create() or legacyFactory()`);
    }
    this.plugins.set(id, plugin);
  }

  get(id: SalesChannelId, credentials: ChannelCredentials = {}): SalesChannelAdapter {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new AppError(`Unsupported sales channel: ${id}`, 400);
    if (plugin.create) return plugin.create(credentials);
    return new LegacySalesChannelBridge(id, plugin.legacyFactory!, plugin.definition.capabilities);
  }

  has(id: SalesChannelId) {
    return this.plugins.has(id);
  }

  listIds(): SalesChannelId[] {
    return [...this.plugins.keys()];
  }

  listDefinitions(): ChannelIntegrationDefinition[] {
    return [...this.plugins.values()].map((p) => p.definition);
  }

  getDefinition(id: SalesChannelId): ChannelIntegrationDefinition {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new AppError(`Unknown sales channel: ${id}`, 404);
    return plugin.definition;
  }
}

export const channelRegistry = new ChannelRegistry();
