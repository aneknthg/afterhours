-- BUG FIX: rsvps.event_id was typed `text` while events.id is `uuid`, so
-- Postgres/PostgREST could never see a foreign-key relationship between the
-- two tables. Every query that relies on PostgREST's embedded-join syntax
-- (`rsvps?select=...,events(...)`) failed with PGRST200 ("Could not find a
-- relationship between 'rsvps' and 'events'") for every user, not just the
-- QA tester. Confirmed broken call sites: Profile.jsx's "Attended" stat/list,
-- useProfile.js, Discover.jsx's personalization query, and
-- PeopleLikeYou.jsx's suggestions.
--
-- Before the type change, clean up legacy rows that can't be reconciled:
-- 10 rows have placeholder seed-data ids ("e1".."e10", not UUIDs at all) and
-- 1 more is a well-formed UUID that no longer matches any event. These
-- belong to 5 real users and predate the real event-creation flow; they
-- can't be pointed at a real event, so they're deleted rather than migrated.

delete from public.rsvps
where event_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   or not exists (select 1 from public.events e where e.id::text = rsvps.event_id);

-- Two host-management RLS policies (20260505_optimize_rls_policies.sql)
-- depend on event_id's current type, so they must be dropped before the
-- ALTER and recreated after, without their events.id::text cast.
drop policy if exists "Hosts can delete rsvps on their events" on public.rsvps;
drop policy if exists "Hosts can update rsvps on their events" on public.rsvps;

alter table public.rsvps
  alter column event_id type uuid using event_id::uuid;

alter table public.rsvps
  add constraint rsvps_event_id_fkey foreign key (event_id)
  references public.events(id) on delete cascade;

create policy "Hosts can delete rsvps on their events" on public.rsvps
  for delete using (
    exists (select 1 from public.events where id = rsvps.event_id and creator_id = (select auth.uid()))
  );

create policy "Hosts can update rsvps on their events" on public.rsvps
  for update using (
    exists (select 1 from public.events where id = rsvps.event_id and creator_id = (select auth.uid()))
  );

-- cancel_event() compared rsvps.event_id (text) against p_event_id (uuid)
-- via an explicit ::text cast, per the type mismatch noted in its own
-- migration (20260612_cancel_event.sql). Now that event_id is uuid, that
-- cast would error (uuid = text has no operator). Recreate without the casts.
create or replace function public.cancel_event(p_event_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title   text;
  v_creator uuid;
begin
  select title, creator_id into v_title, v_creator
  from public.events
  where id = p_event_id;

  if v_title is null then
    raise exception 'Event not found';
  end if;

  if v_creator is distinct from auth.uid() then
    raise exception 'Only the host can cancel this event';
  end if;

  -- Notify every distinct attendee except the host.
  insert into public.user_notifications (user_id, type, event_id, event_title, note, read)
  select distinct r.user_id,
         'event_cancelled',
         p_event_id,
         v_title,
         nullif(btrim(coalesce(p_note, '')), ''),
         false
  from public.rsvps r
  where r.event_id = p_event_id
    and r.user_id is not null
    and r.user_id <> v_creator;

  -- Remove the attendee rows, then the event. (The FK's ON DELETE CASCADE
  -- would also catch this, but keeping it explicit matches the original
  -- function's intent and order of operations.)
  delete from public.rsvps  where event_id = p_event_id;
  delete from public.events where id = p_event_id;
end;
$$;

grant execute on function public.cancel_event(uuid, text) to authenticated;
