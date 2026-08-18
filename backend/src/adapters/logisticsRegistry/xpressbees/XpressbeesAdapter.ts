import { BaseLogisticsAdapter } from "../base/BaseLogisticsAdapter.js";
import { TrackingResult } from "../types.js";
import { logger } from "../../../utils/logger.js";

export class XpressbeesAdapter extends BaseLogisticsAdapter {
  readonly id = "XPRESSBEES" as const;

  async validateCredentials(): Promise<boolean> {
    return this.require(["email", "password"]);
  }

  protected async trackLive(trackingNumber: string): Promise<TrackingResult | null> {
    logger.warn({ trackingNumber }, "Xpressbees live track API not fully wired; returning null");
    void this.credentials;
    return null;
  }
}
