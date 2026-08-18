import type { LogisticsAdapter, LogisticsServiceMeta } from "./types.js";

export interface LogisticsPlugin {
  meta: LogisticsServiceMeta;
  create: () => LogisticsAdapter;
}
