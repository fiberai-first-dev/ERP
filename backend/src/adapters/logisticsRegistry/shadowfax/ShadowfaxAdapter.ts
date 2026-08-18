import { BaseLogisticsAdapter } from "../base/BaseLogisticsAdapter.js";
import { TrackingResult } from "../types.js";
import { logger } from "../../../utils/logger.js";

export class ShadowfaxAdapter extends BaseLogisticsAdapter {
  readonly id = "SHADOWFAX" as const;

  async validateCredentials(): Promise<boolean> {
    return this.require(["apiToken"]);
  }

  protected async trackLive(trackingNumber: string): Promise<TrackingResult | null> {
    logger.warn({ trackingNumber }, "Shadowfax live track API not fully wired");
    void this.credentials;
    return null;
  }
}
