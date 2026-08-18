import { AppError } from "../../middleware/errorHandler.js";
import type { LogisticsAdapter } from "./core/adapter.js";
import type { LogisticsIntegrationDefinition } from "./core/capabilities.js";
import type { LogisticsCredentials, LogisticsProviderId } from "./core/types.js";
import type { LegacyLogisticsFactory } from "./core/legacyBridge.js";
import { LegacyLogisticsBridge } from "./core/legacyBridge.js";
import { UnsupportedChannelError } from "./core/errors.js";

export interface LogisticsPlugin {
  definition: LogisticsIntegrationDefinition;
  create?: () => LogisticsAdapter;
  legacyFactory?: LegacyLogisticsFactory;
}

/**
 * Canonical logistics registry.
 * Channel × logistics pairing is configuration + capabilities — never combinatorial adapters.
 */
export class LogisticsRegistry {
  private readonly plugins = new Map<LogisticsProviderId, LogisticsPlugin>();

  register(plugin: LogisticsPlugin) {
    const id = plugin.definition.id;
    if (this.plugins.has(id)) {
      throw new Error(`Logistics plugin already registered: ${id}`);
    }
    if (!plugin.create && !plugin.legacyFactory) {
      throw new Error(`Logistics plugin ${id} must provide create() or legacyFactory()`);
    }
    this.plugins.set(id, plugin);
  }

  get(id: LogisticsProviderId): LogisticsAdapter {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new AppError(`Unsupported logistics provider: ${id}`, 400);
    if (plugin.create) return plugin.create();
    return new LegacyLogisticsBridge(id, plugin.legacyFactory!, {
      capabilities: plugin.definition.capabilities,
      supportedChannels: plugin.definition.supportedChannels,
    });
  }

  has(id: LogisticsProviderId) {
    return this.plugins.has(id);
  }

  listIds(): LogisticsProviderId[] {
    return [...this.plugins.keys()];
  }

  listDefinitions(): LogisticsIntegrationDefinition[] {
    return [...this.plugins.values()].map((p) => p.definition);
  }

  getDefinition(id: LogisticsProviderId): LogisticsIntegrationDefinition {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new AppError(`Unknown logistics provider: ${id}`, 404);
    return plugin.definition;
  }

  /** Filters by supportedChannels capability — used by Settings. */
  availableForChannel(salesChannelId: string): LogisticsIntegrationDefinition[] {
    return this.listDefinitions().filter((d) => d.supportedChannels.includes(salesChannelId));
  }

  assertCompatible(logisticsId: LogisticsProviderId, salesChannelId: string) {
    const def = this.getDefinition(logisticsId);
    if (!def.supportedChannels.includes(salesChannelId)) {
      throw new UnsupportedChannelError(logisticsId, salesChannelId);
    }
  }
}

export const logisticsRegistry = new LogisticsRegistry();
