-- Rename FAILED_DELIVERY → DELIVERY_FAILED

UPDATE orders
SET status = 'DELIVERY_FAILED'
WHERE status = 'FAILED_DELIVERY';

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_status_check CHECK (
    status IN (
      'NEW',
      'CONFIRMED',
      'PROCESSING',
      'PACKED',
      'READY_FOR_LOGISTICS',
      'PICKED_UP',
      'SHIPPED',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
      'RETURN_REQUESTED',
      'RETURNED',
      'DELIVERY_FAILED'
    )
  );
