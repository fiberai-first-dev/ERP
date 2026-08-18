export type InventoryEventType =
  | "inventory.created"
  | "inventory.updated"
  | "inventory.deleted"
  | "inventory.adjusted";

export type OrderEventType =
  | "order.created"
  | "order.updated"
  | "order.ingested"
  | "order.status_changed";

export type ChannelSyncEventType = "channel.sync" | "channel.status";

export type DomainEventType = InventoryEventType | OrderEventType | ChannelSyncEventType;

export interface InventoryEvent {
  type: InventoryEventType;
  at: string;
  payload: {
    productId?: string;
    sku?: string;
    quantity?: number;
  };
}

export interface OrderEvent {
  type: OrderEventType;
  at: string;
  payload: {
    orderId: string;
    marketplace?: string;
    status?: string;
    previousStatus?: string;
    channelOrderId?: string;
    source?: string;
  };
}

export interface ChannelSyncEvent {
  type: ChannelSyncEventType;
  at: string;
  payload: {
    channel: string;
    status: string;
    enabled?: boolean;
    error?: string | null;
  };
}

export type DomainEvent = InventoryEvent | OrderEvent | ChannelSyncEvent;

export const REDIS_EVENTS_CHANNEL = "erm:events";
