import { BaseLogisticsAdapter } from "../base/BaseLogisticsAdapter.js";
import { TrackingResult } from "../types.js";
import { logger } from "../../../utils/logger.js";

export class EkartAdapter extends BaseLogisticsAdapter {
  readonly id = "EKART" as const;

  async validateCredentials(): Promise<boolean> {
    return this.require(["apiToken"]);
  }

  protected async trackLive(trackingNumber: string): Promise<TrackingResult | null> {
    logger.warn({ trackingNumber }, "Ekart live track API not fully wired");
    void this.credentials;
    return null;
  }
}
