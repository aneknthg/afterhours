-- Add an is_test flag so QA/automation accounts can be created without ever
-- being visible to real users in profile, event, or RSVP surfaces.

alter table public.profiles
  add column if not exists is_test boolean not null default false;

-- public_profiles view: exclude test accounts from every surface that reads
-- through it (people suggestions, chat rosters, public profile pages, connections).
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
where is_test is not true;

grant select on public.public_profiles to authenticated;
grant select on public.public_profiles to anon;

-- events: a restrictive policy ANDs with the existing permissive "viewable by
-- everyone" policy, so it only narrows visibility, never grants new access.
-- Creators can always see their own events (so a test account can verify its
-- own QA events); everyone else never sees events created by a test account.
drop policy if exists "Hide test-account events from other users" on public.events;
create policy "Hide test-account events from other users" on public.events
  as restrictive
  for select
  using (
    creator_id = (select auth.uid())
    or not exists (
      select 1 from public.profiles p
      where p.id = events.creator_id and p.is_test
    )
  );

-- rsvps: same pattern — a test account's RSVPs never appear to other users
-- (event hosts, attendee lists, attendee counts), but the test account can
-- always see its own RSVP rows.
drop policy if exists "Hide test-account rsvps from other users" on public.rsvps;
create policy "Hide test-account rsvps from other users" on public.rsvps
  as restrictive
  for select
  using (
    user_id = (select auth.uid())
    or not exists (
      select 1 from public.profiles p
      where p.id = rsvps.user_id and p.is_test
    )
  );
