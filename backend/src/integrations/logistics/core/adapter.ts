import type {
  CreateShipmentInput,
  LogisticsCredentials,
  LogisticsProviderId,
  PickupResult,
  PickupSlotOption,
  SchedulePickupInput,
  ShipmentResult,
  ShippingLabel,
  TrackingInfo,
} from "./types.js";
import type { LogisticsCapabilities } from "./capabilities.js";

/**
 * Plug-and-play logistics contract.
 * Core fulfillment engine calls only this interface.
 */
export interface LogisticsAdapter {
  readonly id: LogisticsProviderId;
  readonly capabilities: LogisticsCapabilities;

  validateCredentials(): Promise<boolean>;
  connect(credentials: LogisticsCredentials): Promise<void>;

  /** Soft check — registry/catalog also enforce supportedChannels. */
  supportsChannel(salesChannelId: string): boolean;

  createShipment(input: CreateShipmentInput): Promise<ShipmentResult>;
  generateLabel(shipmentId: string): Promise<ShippingLabel>;
  schedulePickup(input: SchedulePickupInput): Promise<PickupResult>;
  getPickupSlots?(shipmentId: string): Promise<PickupSlotOption[]>;
  getTracking(shipmentId: string): Promise<TrackingInfo | null>;
  cancelShipment(shipmentId: string): Promise<void>;
}
