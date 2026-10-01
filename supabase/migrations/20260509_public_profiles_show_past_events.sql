-- Expose show_past_events flag so clients can gate the past events section
-- without needing access to the raw privacy_settings JSON.
-- IS NOT FALSE: returns TRUE when the field is null/unset (default-on), FALSE only when explicitly disabled.
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
  (privacy_settings->>'show_past_events')::boolean IS NOT FALSE AS show_past_events
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;
