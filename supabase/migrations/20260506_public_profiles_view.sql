-- SECURITY: expose only safe public columns; sensitive fields (phone_verified_at, gender, buddy_system, safety_checkins, privacy_settings) never leave the DB
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  id,
  display_name,
  avatar_url,
  CASE WHEN (privacy_settings->>'show_bio')::boolean IS NOT FALSE THEN bio ELSE NULL END AS bio,
  CASE WHEN (privacy_settings->>'show_location')::boolean IS NOT FALSE THEN city ELSE NULL END AS city,
  CASE WHEN (privacy_settings->>'show_location')::boolean IS NOT FALSE THEN country ELSE NULL END AS country,
  hobbies,
  trust_level,
  avg_host_rating,
  events_hosted,
  events_attended,
  created_at
FROM public.profiles;

-- SECURITY: only row owner can read full profile; use public_profiles view for others
DROP POLICY IF EXISTS "Profile rows readable by anyone authed" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Owner can read own profile'
  ) THEN
    CREATE POLICY "Owner can read own profile"
      ON public.profiles FOR SELECT
      USING (auth.uid() = id);
  END IF;
END $$;

-- SECURITY: allow public_profiles view to be queried by all (safe columns only)
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;
