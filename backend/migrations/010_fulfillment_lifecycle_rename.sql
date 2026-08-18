-- Rename canonical order statuses to the final fulfillment lifecycle.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

UPDATE orders SET status = CASE status
  WHEN 'PROCESSING' THEN 'READY_TO_PACK'
  WHEN 'READY_FOR_LOGISTICS' THEN 'PICKUP_SCHEDULED'
  WHEN 'SHIPPED' THEN 'IN_TRANSIT'
  ELSE status
END;

ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'READY_TO_PACK';

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check CHECK (
    status IN (
      'NEW',
      'CONFIRMED',
      'READY_TO_PACK',
      'PACKED',
      'SHIPMENT_CREATED',
      'PICKUP_SCHEDULED',
      'PICKED_UP',
      'IN_TRANSIT',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
      'RETURN_REQUESTED',
      'RETURNED',
      'DELIVERY_FAILED'
    )
  );
