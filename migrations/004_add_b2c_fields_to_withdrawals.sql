ALTER TABLE withdrawals
  ADD COLUMN mpesa_conversation_id TEXT,
  ADD COLUMN mpesa_originator_conversation_id TEXT,
  ADD COLUMN failure_reason TEXT,
  ADD COLUMN completed_at TIMESTAMP;