-- SECURITY: extend the EXISTING profiles guard to cover the unprotected sensitive
-- columns. Do NOT add a second trigger.
--
-- Production already has a BEFORE UPDATE trigger `trg_guard_profile_trust` bound to
-- `guard_profile_trust_cols()`, which reverts client changes to trust_level,
-- phone_verified_at, and verified_at. Its bypass is the GUC
-- `app.bypass_trust_guard = 'on'`, which backend writers set. (Neither the trigger
-- nor the GUC setup is in this repo — they are prod-only drift.)
--
-- This migration CREATE OR REPLACEs that one function to ALSO protect
-- verification_status, verification_at, role, and gender. The existing
-- trg_guard_profile_trust keeps binding it, so no trigger DDL is needed.
--
-- ⚠ ORDERING PREREQUISITE — read before running:
--   Once verification_status is guarded, any writer WITHOUT the bypass GUC will have
--   its 'verified' write reverted. The verify-identity edge function currently does a
--   plain PostgREST update with NO bypass. Confirm the edge function bypasses the
--   guard (role-level GUC, or an RPC that sets it) BEFORE running this, or new
--   verifications will set status that immediately reverts to its old value.

-- Defensive: remove the mistakenly-proposed parallel guard if it was ever applied
-- in any environment. It is superseded by extending guard_profile_trust_cols below.
DROP TRIGGER IF EXISTS protect_sensitive_profile_columns ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_sensitive_profile_columns();

CREATE OR REPLACE FUNCTION public.guard_profile_trust_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public   -- hardening addition for SECURITY DEFINER; see notes
AS $$
BEGIN
  -- Backend writers (edge functions / SECURITY DEFINER RPCs) set this GUC to bypass.
  IF current_setting('app.bypass_trust_guard', true) = 'on' THEN
    RETURN new;
  END IF;

  -- Existing protections (unchanged behaviour)
  IF new.trust_level       IS DISTINCT FROM old.trust_level       THEN new.trust_level       := old.trust_level;       END IF;
  IF new.phone_verified_at IS DISTINCT FROM old.phone_verified_at THEN new.phone_verified_at := old.phone_verified_at; END IF;
  IF new.verified_at       IS DISTINCT FROM old.verified_at       THEN new.verified_at       := old.verified_at;       END IF;

  -- Newly protected columns (close the client self-grant hole)
  IF new.verification_status IS DISTINCT FROM old.verification_status THEN new.verification_status := old.verification_status; END IF;
  IF new.verification_at     IS DISTINCT FROM old.verification_at     THEN new.verification_at     := old.verification_at;     END IF;
  IF new.role                IS DISTINCT FROM old.role                THEN new.role                := old.role;                END IF;
  IF new.gender              IS DISTINCT FROM old.gender              THEN new.gender              := old.gender;              END IF;

  RETURN new;
END;
$$;
