-- Host-initiated event cancellation.
--
-- Adds a free-text cancellation note to notifications, and a SECURITY DEFINER
-- RPC that atomically:
--   1. verifies the caller is the event's host,
--   2. notifies every attendee (type 'event_cancelled', carrying the event
--      title + the host's note, denormalised since the event row is deleted),
--   3. removes the attendee rows, then the event itself.
--
-- Hard delete (product decision): old /event/<id> links and the event chat go
-- away; the notification is the attendee's record that it happened and why.
--
-- Notes on types: user_notifications.event_id is uuid; rsvps.event_id is text,
-- so the rsvps match casts the uuid to text. note is nullable — an empty/blank
-- note is stored as NULL and the client shows a generic line.

alter table public.user_notifications
  add column if not exists note text;

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
  where r.event_id = p_event_id::text
    and r.user_id is not null
    and r.user_id <> v_creator;

  -- Remove the attendee rows, then the event.
  delete from public.rsvps  where event_id = p_event_id::text;
  delete from public.events where id = p_event_id;
end;
$$;

grant execute on function public.cancel_event(uuid, text) to authenticated;
