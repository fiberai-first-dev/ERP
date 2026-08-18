import { query } from "../config/db.js";
import { Shipment, ShipmentStatus } from "../models/domain.js";

function mapRow(row: Record<string, unknown>): Shipment {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    channelShipmentId: row.channel_shipment_id ? String(row.channel_shipment_id) : null,
    status: row.status as ShipmentStatus,
    fulfillmentType: row.fulfillment_type ? String(row.fulfillment_type) : null,
    carrier: row.carrier ? String(row.carrier) : null,
    trackingNumber: row.tracking_number ? String(row.tracking_number) : null,
    metadata: (row.metadata as Record<string, unknown>) || {},
    shippedAt: row.shipped_at ? new Date(String(row.shipped_at)).toISOString() : null,
    deliveredAt: row.delivered_at ? new Date(String(row.delivered_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export class ShipmentRepository {
  async findByOrderId(orderId: string): Promise<Shipment[]> {
    const result = await query("SELECT * FROM shipments WHERE order_id = $1 ORDER BY created_at DESC", [orderId]);
    return result.rows.map(mapRow);
  }

  async findLatestByOrderIds(orderIds: string[]): Promise<Map<string, Shipment>> {
    const map = new Map<string, Shipment>();
    if (!orderIds.length) return map;
    const result = await query(
      `SELECT DISTINCT ON (order_id) *
       FROM shipments
       WHERE order_id = ANY($1::uuid[])
       ORDER BY order_id, created_at DESC`,
      [orderIds]
    );
    for (const row of result.rows) {
      const shipment = mapRow(row);
      map.set(shipment.orderId, shipment);
    }
    return map;
  }

  async upsertForOrder(input: {
    orderId: string;
    channelShipmentId?: string | null;
    status: ShipmentStatus;
    fulfillmentType?: string | null;
    carrier?: string | null;
    trackingNumber?: string | null;
    metadata?: Record<string, unknown>;
    shippedAt?: string | null;
    deliveredAt?: string | null;
  }): Promise<Shipment> {
    const existing = await query("SELECT * FROM shipments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1", [
      input.orderId,
    ]);

    if (existing.rows[0]) {
      const result = await query(
        `UPDATE shipments SET
           channel_shipment_id = COALESCE($2, channel_shipment_id),
           status = $3,
           fulfillment_type = COALESCE($4, fulfillment_type),
           carrier = COALESCE($5, carrier),
           tracking_number = COALESCE($6, tracking_number),
           metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE($7::jsonb, '{}'::jsonb),
           shipped_at = COALESCE($8::timestamptz, shipped_at),
           delivered_at = COALESCE($9::timestamptz, delivered_at),
           updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          existing.rows[0].id,
          input.channelShipmentId || null,
          input.status,
          input.fulfillmentType || null,
          input.carrier || null,
          input.trackingNumber || null,
          JSON.stringify(input.metadata || {}),
          input.shippedAt || null,
          input.deliveredAt || null,
        ]
      );
      return mapRow(result.rows[0]);
    }

    const result = await query(
      `INSERT INTO shipments (
         order_id, channel_shipment_id, status, fulfillment_type, carrier,
         tracking_number, metadata, shipped_at, delivered_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
       RETURNING *`,
      [
        input.orderId,
        input.channelShipmentId || null,
        input.status,
        input.fulfillmentType || null,
        input.carrier || null,
        input.trackingNumber || null,
        JSON.stringify(input.metadata || {}),
        input.shippedAt || null,
        input.deliveredAt || null,
      ]
    );
    return mapRow(result.rows[0]);
  }
}

export const shipmentRepository = new ShipmentRepository();
