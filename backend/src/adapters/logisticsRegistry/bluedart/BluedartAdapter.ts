import { BaseLogisticsAdapter } from "../base/BaseLogisticsAdapter.js";
import { TrackingResult } from "../types.js";
import { logger } from "../../../utils/logger.js";

/** Blue Dart SOAP/REST vary by account — live path is a documented hook with sim-first usage. */
export class BluedartAdapter extends BaseLogisticsAdapter {
  readonly id = "BLUEDART" as const;

  async validateCredentials(): Promise<boolean> {
    return this.require(["loginId", "licenseKey"]);
  }

  protected async trackLive(trackingNumber: string): Promise<TrackingResult | null> {
    logger.warn({ trackingNumber }, "Blue Dart live track API not fully wired; returning null");
    void this.credentials;
    return null;
  }
}
