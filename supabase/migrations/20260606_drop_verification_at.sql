-- ============================================================================
-- DESTRUCTIVE — DO NOT RUN until ALL prerequisites below are satisfied.
-- Dropping verification_at is irreversible. This file is staged for review only.
-- ============================================================================
--
-- PREREQUISITES (do these first, in order):
--   1. The verification_at write now lives in the set_identity_verification RPC
--      (the edge function calls the RPC, it does not write the column directly).
--      This file recreates that RPC without verification_at below, so the edge
--      function needs no further change — but confirm no other RPC writes it.
--   2. Confirm the 20260605_2 backfill ran and verified_at is fully populated
--      (the guard block below enforces this).
--   3. Ensure 20260605_4_profiles_protect_sensitive_columns.sql has been applied, so
--      guard_profile_trust_cols() already protects verification_at — this file then
--      removes that column from both the function and the RPC before dropping it.
--   4. Work through the EXTERNAL-READ CHECKLIST below.
--
-- EXTERNAL-READ CHECKLIST (nothing in this repo reads verification_at; verify
-- outside the repo before dropping):
--   [ ] Supabase Studio saved SQL snippets / saved queries
--   [ ] BI tools: Metabase, Looker, Retool, Mode, Grafana, etc.
--   [ ] Scheduled exports / ETL / warehouse syncs (BigQuery, Snowflake, Fivetran)
--   [ ] Other Supabase edge functions or backend/cron services
--   [ ] The iOS app repo (afterhoursadmins/Afterhours-App) — its own code + migrations
--   [ ] Supabase Realtime subscriptions or Database Webhooks selecting this column
--   [ ] Any analytics events / third-party syncs that include verification_at
--
-- SANITY CHECK (run manually first; expect 0):
--   select count(*) from public.profiles
--   where verified_at is null and verification_at is not null;
-- ============================================================================

-- Guard: abort if any row still has a verification_at timestamp not copied into
-- verified_at (i.e. the backfill is incomplete). Expect this to pass silently.
DO $$
DECLARE
  unmigrated integer;
BEGIN
  SELECT count(*) INTO unmigrated
  FROM public.profiles
  WHERE verified_at IS NULL AND verification_at IS NOT NULL;
  IF unmigrated > 0 THEN
    RAISE EXCEPTION
      'Aborting drop: % row(s) still have verification_at but NULL verified_at. Run the 20260605_2 backfill first.',
      unmigrated;
  END IF;
END $$;

-- guard_profile_trust_cols() references new/old.verification_at, so it must be
-- recreated without that line before the column can be dropped. This is the same
-- function as 20260605, minus the verification_at protection.
CREATE OR REPLACE FUNCTION public.guard_profile_trust_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.bypass_trust_guard', true) = 'on' THEN
    RETURN new;
  END IF;

  IF new.trust_level       IS DISTINCT FROM old.trust_level       THEN new.trust_level       := old.trust_level;       END IF;
  IF new.phone_verified_at IS DISTINCT FROM old.phone_verified_at THEN new.phone_verified_at := old.phone_verified_at; END IF;
  IF new.verified_at       IS DISTINCT FROM old.verified_at       THEN new.verified_at       := old.verified_at;       END IF;
  IF new.verification_status IS DISTINCT FROM old.verification_status THEN new.verification_status := old.verification_status; END IF;
  IF new.role                IS DISTINCT FROM old.role                THEN new.role                := old.role;                END IF;
  IF new.gender              IS DISTINCT FROM old.gender              THEN new.gender              := old.gender;              END IF;

  RETURN new;
END;
$$;

-- set_identity_verification() also writes verification_at, so recreate it without
-- that column before the drop. Identical to 20260605 minus the verification_at line.
CREATE OR REPLACE FUNCTION public.set_identity_verification(
  p_user_id uuid,
  p_status  text,
  p_gender  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'cannot set verification for another user';
  END IF;
  IF p_status NOT IN ('unverified', 'pending', 'verified', 'failed') THEN
    RAISE EXCEPTION 'invalid verification status: %', p_status;
  END IF;

  PERFORM set_config('app.bypass_trust_guard', 'on', true);

  UPDATE public.profiles
  SET verification_status = p_status,
      verified_at = CASE WHEN p_status = 'verified' THEN COALESCE(verified_at, now()) ELSE verified_at END,
      gender      = COALESCE(p_gender, gender),
      updated_at  = now()
  WHERE id = p_user_id;

  PERFORM set_config('app.bypass_trust_guard', 'off', true);
END;
$$;

-- Finally, drop the deprecated column.
ALTER TABLE public.profiles DROP COLUMN verification_at;
