-- POLICY: Nominatim's usage policy prohibits bulk/client-side geocoding above minimal use and
-- requires a server-side proxy with caching at scale (see comment in app/(tabs)/create.tsx
-- LocationPicker). This backs the `geocode` Edge Function: a cache table keyed on the
-- normalized query string (30 day TTL) and a per-user rate-limit table.

CREATE TABLE IF NOT EXISTS public.geocode_cache (
  query_key  text PRIMARY KEY,
  results    jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.geocode_rate_limit (
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  count        int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, window_start)
);

ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geocode_rate_limit ENABLE ROW LEVEL SECURITY;

-- Both tables are only ever touched by the geocode Edge Function using the service role key,
-- which bypasses RLS — no client-facing policies are needed (default deny for anon/authenticated).

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup-geocode-cache';
SELECT cron.schedule(
  'cleanup-geocode-cache',
  '0 3 * * *', -- daily at 03:00
  $$DELETE FROM public.geocode_cache WHERE created_at < now() - interval '30 days'$$
);

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup-geocode-rate-limit';
SELECT cron.schedule(
  'cleanup-geocode-rate-limit',
  '* * * * *',
  $$DELETE FROM public.geocode_rate_limit WHERE window_start < now() - interval '2 minutes'$$
);
