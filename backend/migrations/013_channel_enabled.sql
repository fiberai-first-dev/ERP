-- Per-channel sync gate. Default off until vendor connects.
ALTER TABLE channels_config
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT false;

-- Only channels that are currently connected should start enabled.
UPDATE channels_config
SET enabled = true
WHERE status = 'CONNECTED'
  AND credentials ? 'enc'
  AND length(COALESCE(credentials->>'enc', '')) > 20;

-- Clear unusable ERROR states caused by corrupt/placeholder ciphertext
-- (e.g. "Invalid initialization vector").
UPDATE channels_config
SET status = 'DISCONNECTED',
    enabled = false,
    credentials = '{}'::jsonb,
    last_error = NULL,
    updated_at = NOW()
WHERE status = 'ERROR'
  AND (
    last_error ILIKE '%initialization vector%'
    OR last_error ILIKE '%Unsupported state%'
    OR last_error ILIKE '%unable to authenticate%'
    OR last_error ILIKE '%bad decrypt%'
    OR credentials->>'enc' IS NULL
    OR length(COALESCE(credentials->>'enc', '')) < 20
  );
