-- Expose verification_status on public_profiles so client-side surfaces
-- (PeopleLikeYou, connection suggestions, etc.) can exclude unverified accounts
-- without leaking the raw profiles table.
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
  created_at,
  (privacy_settings->>'show_past_events')::boolean IS NOT FALSE AS show_past_events,
  verification_status
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;
