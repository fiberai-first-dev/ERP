import { BaseLogisticsAdapter } from "../base/BaseLogisticsAdapter.js";
import { TrackingResult } from "../types.js";
import { logger } from "../../../utils/logger.js";

export class EcomExpressAdapter extends BaseLogisticsAdapter {
  readonly id = "ECOM_EXPRESS" as const;

  async validateCredentials(): Promise<boolean> {
    return this.require(["username", "password"]);
  }

  protected async trackLive(trackingNumber: string): Promise<TrackingResult | null> {
    logger.warn({ trackingNumber }, "Ecom Express live track API not fully wired; returning null");
    void this.credentials;
    return null;
  }
}
