-- Re-verification on profile-photo change.
--
-- Identity verification matches the selfie against the stored profile picture, so a
-- changed/removed photo must invalidate verification. verification_status is guarded
-- (clients can't set it directly), so the reset has to happen INSIDE the guard.
--
-- This CREATE OR REPLACEs the existing guard_profile_trust_cols() (see
-- 20260605_4_profiles_protect_sensitive_columns.sql), adding an avatar-change reset
-- AFTER the protection reverts so it overrides them. Only the non-bypass (normal user)
-- path is affected; backend verification writes use app.bypass_trust_guard='on' and
-- don't touch avatar_url, so they're unaffected.
--
-- Note: the app appends a cache-busting ?t=<ts> to avatar_url on every upload, so any
-- photo change/remove is a real string change and reliably triggers the reset.

CREATE OR REPLACE FUNCTION public.guard_profile_trust_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Backend writers (edge functions / SECURITY DEFINER RPCs) set this GUC to bypass.
  IF current_setting('app.bypass_trust_guard', true) = 'on' THEN
    RETURN new;
  END IF;

  -- Existing protections (unchanged)
  IF new.trust_level         IS DISTINCT FROM old.trust_level         THEN new.trust_level         := old.trust_level;         END IF;
  IF new.phone_verified_at   IS DISTINCT FROM old.phone_verified_at   THEN new.phone_verified_at   := old.phone_verified_at;   END IF;
  IF new.verified_at         IS DISTINCT FROM old.verified_at         THEN new.verified_at         := old.verified_at;         END IF;
  IF new.verification_status IS DISTINCT FROM old.verification_status THEN new.verification_status := old.verification_status; END IF;
  IF new.verification_at     IS DISTINCT FROM old.verification_at     THEN new.verification_at     := old.verification_at;     END IF;
  IF new.role                IS DISTINCT FROM old.role                THEN new.role                := old.role;                END IF;
  IF new.gender              IS DISTINCT FROM old.gender              THEN new.gender              := old.gender;              END IF;

  -- NEW: changing/removing the profile photo invalidates verification. Placed AFTER
  -- the reverts above so it intentionally overrides the verification_status revert.
  IF new.avatar_url IS DISTINCT FROM old.avatar_url THEN
    new.verification_status := 'unverified';
    new.verified_at         := NULL;
    new.verification_at     := NULL;
  END IF;

  RETURN new;
END;
$$;
