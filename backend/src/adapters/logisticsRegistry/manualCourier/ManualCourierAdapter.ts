import { BaseLogisticsAdapter } from "../base/BaseLogisticsAdapter.js";
import { TrackingResult } from "../types.js";

/** No courier API — tracking is maintained in ERM / Simulation only. */
export class ManualCourierAdapter extends BaseLogisticsAdapter {
  readonly id = "MANUAL_COURIER" as const;

  async validateCredentials(): Promise<boolean> {
    return true;
  }

  protected async trackLive(_trackingNumber: string): Promise<TrackingResult | null> {
    return null;
  }
}
