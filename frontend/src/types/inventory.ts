export interface ChannelSyncResult {
  channel: string;
  ok: boolean;
  error?: string;
}

export interface Inventory {
  id: string;
  name: string;
  sku?: string;
  quantity: number;
  price?: number;
  description?: string;
  imageUrl?: string | null;
  channelSync?: ChannelSyncResult[];
}
