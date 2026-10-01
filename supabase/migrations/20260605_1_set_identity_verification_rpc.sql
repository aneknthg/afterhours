-- Identity-verification writer RPC. Mirrors the upgrade_trust_level pattern: it sets
-- the app.bypass_trust_guard GUC so it can write the columns protected by
-- guard_profile_trust_cols(), does ONE update, then clears the GUC. This is the
-- single, consistent bypass path for verification writes.
--
-- SECURITY MODEL (deliberate):
--   * SECURITY DEFINER so it can bypass the guard.
--   * EXECUTE granted to service_role ONLY. The verify-identity edge function calls
--     it via the service-role client (auth.uid() is NULL there), AFTER it has run the
--     Rekognition liveness + gender checks. The edge function is the trusted gate.
--   * DO NOT grant EXECUTE to authenticated/anon. The identity guard below only
--     blocks setting verification for a DIFFERENT user; a user calling it for
--     THEMSELVES would pass it. So the real control against self-verification is the
--     EXECUTE restriction, not the guard. Granting it to authenticated would
--     re-open the privilege-escalation hole this whole change closes.

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
  -- Defense in depth (no-op when called as service_role, where auth.uid() is NULL).
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'cannot set verification for another user';
  END IF;

  IF p_status NOT IN ('unverified', 'pending', 'verified', 'failed') THEN
    RAISE EXCEPTION 'invalid verification status: %', p_status;
  END IF;

  PERFORM set_config('app.bypass_trust_guard', 'on', true);

  UPDATE public.profiles
  SET verification_status = p_status,
      -- timestamps only on success; COALESCE keeps the first verification instant
      verification_at = CASE WHEN p_status = 'verified' THEN COALESCE(verification_at, now()) ELSE verification_at END,
      verified_at     = CASE WHEN p_status = 'verified' THEN COALESCE(verified_at, now())     ELSE verified_at     END,
      gender          = COALESCE(p_gender, gender),
      updated_at      = now()
  WHERE id = p_user_id;

  PERFORM set_config('app.bypass_trust_guard', 'off', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_identity_verification(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_identity_verification(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.set_identity_verification(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_identity_verification(uuid, text, text) TO service_role;
