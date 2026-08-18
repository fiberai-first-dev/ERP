import { ChannelType } from "../../models/domain.js";
import {
  LogisticsServiceId,
  LogisticsServiceMeta,
} from "./types.js";

/**
 * Marketplace-native logistics are NOT catalog entries.
 * They are implied by channel fulfillment methods (FBA, NFBF, Easy Ship, …).
 * The selectable logistics catalog is EXTERNAL couriers / aggregators only.
 */
export const MARKETPLACE_LOGISTICS: LogisticsServiceMeta[] = [];

const externalById = new Map<LogisticsServiceId, LogisticsServiceMeta>();

/** Called by logisticsRegistry when plugins register. */
export function registerLogisticsMeta(meta: LogisticsServiceMeta) {
  if (meta.kind === "MARKETPLACE") {
    // Marketplace-owned flows belong on channel fulfillment methods, not this catalog.
    return;
  }
  externalById.set(meta.id, meta);
}

function rebuildCatalog(): LogisticsServiceMeta[] {
  return [...externalById.values()];
}

/** Live catalog — external logistics providers only. */
export function getLogisticsCatalog(): LogisticsServiceMeta[] {
  return rebuildCatalog();
}

/** @deprecated prefer getLogisticsCatalog() — kept as getter-backed array for call sites */
export const LOGISTICS_CATALOG: LogisticsServiceMeta[] = new Proxy([] as LogisticsServiceMeta[], {
  get(_target, prop, receiver) {
    const catalog = rebuildCatalog();
    const value = Reflect.get(catalog, prop, receiver);
    return typeof value === "function" ? value.bind(catalog) : value;
  },
});

export function getExternalLogisticsPartners(): LogisticsServiceMeta[] {
  return [...externalById.values()];
}

/** @deprecated use getExternalLogisticsPartners() */
export const EXTERNAL_LOGISTICS_PARTNERS = new Proxy([] as LogisticsServiceMeta[], {
  get(_target, prop, receiver) {
    const list = getExternalLogisticsPartners();
    const value = Reflect.get(list, prop, receiver);
    return typeof value === "function" ? value.bind(list) : value;
  },
});

/** @deprecated */
export const LOGISTICS_PARTNERS = EXTERNAL_LOGISTICS_PARTNERS;

export function isLogisticsServiceId(value: string): value is LogisticsServiceId {
  return rebuildCatalog().some((s) => s.id === value);
}

/** @deprecated */
export function isLogisticsPartnerId(value: string): value is LogisticsServiceId {
  return isLogisticsServiceId(value);
}

export function getLogisticsServiceMeta(id: LogisticsServiceId): LogisticsServiceMeta {
  const hit = rebuildCatalog().find((s) => s.id === id);
  if (!hit) throw new Error(`Unknown logistics service: ${id}`);
  return hit;
}

/** @deprecated */
export function getLogisticsPartnerMeta(id: LogisticsServiceId) {
  return getLogisticsServiceMeta(id);
}

export function marketplaceLogisticsFor(_channel: ChannelType): LogisticsServiceId | null {
  return null;
}

export function logisticsRequiresCredentials(id: LogisticsServiceId): boolean {
  return getLogisticsServiceMeta(id).requiredFields.length > 0;
}

export * from "./types.js";
