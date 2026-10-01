-- BUG FIX: the restrictive policies added in 20260617_is_test_account_isolation.sql
-- and 20260617_2_is_test_chat_isolation.sql each queried public.profiles directly
-- inside their USING clause to check is_test. But profiles RLS only allows reading
-- your OWN row ("Owner can read own profile") — so for anyone other than the row's
-- owner, that nested subquery always returns zero rows, making `NOT EXISTS(...)`
-- always true and silently defeating the restriction for everyone except the
-- test account itself. Confirmed via anon REST calls: events and rsvps both leaked
-- test-account rows.
--
-- Fix: a SECURITY DEFINER helper function bypasses RLS for this one narrow boolean
-- check (it only ever returns true/false, never profile data, so it's safe to expose
-- broadly). Restrictive policies now call this function instead of querying
-- profiles directly.

create or replace function public.is_test_profile(profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_test from public.profiles where id = profile_id), false);
$$;

revoke all on function public.is_test_profile(uuid) from public;
grant execute on function public.is_test_profile(uuid) to authenticated, anon;

drop policy if exists "Hide test-account events from other users" on public.events;
create policy "Hide test-account events from other users" on public.events
  as restrictive
  for select
  using (
    creator_id = (select auth.uid())
    or not public.is_test_profile(creator_id)
  );

drop policy if exists "Hide test-account rsvps from other users" on public.rsvps;
create policy "Hide test-account rsvps from other users" on public.rsvps
  as restrictive
  for select
  using (
    user_id = (select auth.uid())
    or not public.is_test_profile(user_id)
  );

drop policy if exists "Hide test-account messages from other users" on public.messages;
create policy "Hide test-account messages from other users" on public.messages
  as restrictive
  for select
  using (
    user_id = (select auth.uid())
    or not public.is_test_profile(user_id)
  );

drop policy if exists "Hide test-account poll votes from other users" on public.poll_votes;
create policy "Hide test-account poll votes from other users" on public.poll_votes
  as restrictive
  for select
  using (
    user_id = (select auth.uid())
    or not public.is_test_profile(user_id)
  );
