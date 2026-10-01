-- Schema drift cleanup: gender and phone_verified_at exist in production but were
-- never declared in the tracked schema or migrations. Declare them so a fresh deploy
-- from the repo matches prod. Idempotent and non-destructive (no data touched).
--
-- gender: set by the verify-identity edge function from Rekognition ('Male'/'Female').
-- phone_verified_at: timestamp of SMS verification (read by trust.service).

alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists phone_verified_at timestamptz;
