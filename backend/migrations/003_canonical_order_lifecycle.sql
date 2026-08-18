-- Canonical order lifecycle (text status for flexible evolution)
ALTER TABLE orders
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE orders
  ALTER COLUMN status TYPE TEXT USING status::text;

UPDATE orders SET status = CASE status
  WHEN 'AWAITING_PACKAGING' THEN 'PROCESSING'
  WHEN 'AWAITING_SHIPPING' THEN 'PACKED'
  WHEN 'IN_TRANSIT' THEN 'SHIPPED'
  WHEN 'RTO' THEN 'DELIVERY_FAILED'
  ELSE status
END;

ALTER TABLE orders
  ALTER COLUMN status SET DEFAULT 'PROCESSING';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS last_status_source TEXT;

DO $$ BEGIN
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
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
