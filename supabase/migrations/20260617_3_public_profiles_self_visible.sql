-- The is_test filter on public_profiles (20260617_is_test_account_isolation.sql)
-- hid a test account from EVERYONE, including itself — e.g. a test account
-- viewing its own event showed "Hosted by: Unknown Host" because the
-- creator_id join through public_profiles came back empty. Add a self-visibility
-- exception so a test account still sees its own row, matching the pattern
-- already used on events/rsvps/messages (visible to self, hidden from others).
create or replace view public.public_profiles as
select
  id,
  display_name,
  avatar_url,
  case when (privacy_settings->>'show_bio')::boolean is not false then bio else null end as bio,
  case when (privacy_settings->>'show_location')::boolean is not false then city else null end as city,
  case when (privacy_settings->>'show_location')::boolean is not false then country else null end as country,
  hobbies,
  trust_level,
  avg_host_rating,
  events_hosted,
  events_attended,
  created_at,
  (privacy_settings->>'show_past_events')::boolean is not false as show_past_events,
  verification_status
from public.profiles
where is_test is not true or id = (select auth.uid());

grant select on public.public_profiles to authenticated;
grant select on public.public_profiles to anon;
