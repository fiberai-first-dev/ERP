import { BaseLogisticsAdapter } from "../base/BaseLogisticsAdapter.js";
import { TrackingResult } from "../types.js";
import { logger } from "../../../utils/logger.js";

export class DtdcAdapter extends BaseLogisticsAdapter {
  readonly id = "DTDC" as const;

  async validateCredentials(): Promise<boolean> {
    return this.require(["customerCode", "apiKey"]);
  }

  protected async trackLive(trackingNumber: string): Promise<TrackingResult | null> {
    logger.warn({ trackingNumber }, "DTDC live track API not fully wired; returning null");
    void this.credentials;
    return null;
  }
}
