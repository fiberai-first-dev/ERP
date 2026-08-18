import { BaseLogisticsAdapter } from "./BaseLogisticsAdapter.js";
import { LogisticsServiceId, TrackingResult } from "../types.js";
import { logger } from "../../../utils/logger.js";

/**
 * Lightweight plug-and-play adapter for couriers whose live track API
 * is not fully wired yet (sim mode + credential validation still work).
 */
export class GenericExternalAdapter extends BaseLogisticsAdapter {
  constructor(
    readonly id: LogisticsServiceId,
    private readonly credentialKeys: string[] = ["apiToken"]
  ) {
    super();
  }

  async validateCredentials(): Promise<boolean> {
    if (!this.credentialKeys.length) return true;
    return this.require(this.credentialKeys);
  }

  protected async trackLive(trackingNumber: string): Promise<TrackingResult | null> {
    logger.warn({ trackingNumber, partner: this.id }, "Live track API not fully wired for this 3PL");
    void this.credentials;
    return null;
  }
}
