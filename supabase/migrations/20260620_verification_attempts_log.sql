-- Logs every verify-identity outcome (similarity, gender confidence, result) so
-- thresholds can eventually be tuned from real data instead of the hardcoded
-- 70%/80% cutoffs in supabase/functions/verify-identity/index.ts. Previously
-- these numbers were computed and returned to the client, then discarded.
-- Service-role only — written exclusively by the verify-identity edge function.
--
-- Named identity_verification_log, NOT verification_attempts — that name is
-- already taken by the pre-existing rate-limit table backing the
-- record_verification_attempt RPC (user_id/window_start/count, same shape as
-- geocode_rate_limit). Confirmed via prod schema introspection 2026-06-20.

CREATE TABLE IF NOT EXISTS public.identity_verification_log (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  result             text NOT NULL CHECK (result IN ('verified', 'failed')),
  reason             text NOT NULL,
  similarity         numeric,
  gender             text,
  gender_confidence  numeric,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS identity_verification_log_user_id_idx ON public.identity_verification_log(user_id);

ALTER TABLE public.identity_verification_log ENABLE ROW LEVEL SECURITY;
-- No client-facing policies: only the edge function (service role) writes or reads this table.
