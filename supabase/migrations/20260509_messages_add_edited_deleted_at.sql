-- Add edited_at and deleted_at columns to messages.
-- These were referenced in application code but never created,
-- causing silent fallbacks that stripped edit/delete timestamps.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS edited_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
