import {
  getLogisticsCatalog,
  getExternalLogisticsPartners,
} from "../adapters/logisticsRegistry/index.js";

/** Catalog-only surface — logistics credentials live on per-channel logistics_configs. */
export class LogisticsService {
  catalog() {
    return {
      services: getLogisticsCatalog(),
      external: getExternalLogisticsPartners(),
    };
  }
}

export const logisticsService = new LogisticsService();
