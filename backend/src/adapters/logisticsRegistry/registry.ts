import { z } from "zod";
import { AppError } from "../../middleware/errorHandler.js";
import {
  LogisticsAdapter,
  LogisticsCredentials,
  LogisticsServiceId,
} from "./types.js";
import {
  getLogisticsServiceMeta,
  isLogisticsServiceId,
  registerLogisticsMeta,
} from "./catalog.js";
import type { LogisticsPlugin } from "./plugin.js";

/**
 * Plug-and-play logistics registry.
 * Adding a courier: create logisticsRegistry/<name>/index.ts exporting a LogisticsPlugin,
 * then append it to `plugins` in ./index.ts (single line).
 */
export class LogisticsRegistry {
  private adapters = new Map<string, () => LogisticsAdapter>();

  register(plugin: LogisticsPlugin) {
    registerLogisticsMeta(plugin.meta);
    this.adapters.set(plugin.meta.id, plugin.create);
  }

  registerFactory(type: string, factory: () => LogisticsAdapter) {
    this.adapters.set(type, factory);
  }

  get(type: string): LogisticsAdapter {
    const factory = this.adapters.get(type);
    if (!factory) {
      throw new AppError(`Unsupported logistics provider: ${type}`, 400);
    }
    return factory();
  }

  has(type: string) {
    return this.adapters.has(type);
  }

  listIds(): string[] {
    return [...this.adapters.keys()];
  }
}

export const logisticsRegistry = new LogisticsRegistry();

/** @deprecated use logisticsRegistry.get */
export function createLogisticsPartner(id: LogisticsServiceId): LogisticsAdapter {
  return logisticsRegistry.get(id);
}

export function parseLogisticsCredentials(
  partner: LogisticsServiceId,
  raw: Record<string, string> = {}
) {
  const meta = getLogisticsServiceMeta(partner);
  if (meta.requiredFields.length === 0) {
    return {} as LogisticsCredentials;
  }
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of meta.requiredFields) {
    shape[field.key] = z
      .string({ required_error: `${field.label} is required` })
      .min(1, `${field.label} is required`);
  }
  const result = z.object(shape).safeParse(raw || {});
  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join("; ");
    throw new AppError(message || "Invalid logistics credentials", 400);
  }
  return result.data as LogisticsCredentials;
}

export async function connectLogisticsPartner(
  partner: LogisticsServiceId,
  credentials: LogisticsCredentials = {}
) {
  if (!isLogisticsServiceId(partner)) {
    throw new AppError(`Unsupported logistics provider: ${partner}`, 400);
  }
  const adapter = logisticsRegistry.get(partner);
  await adapter.connect(credentials);
  return adapter;
}
