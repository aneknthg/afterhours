-- BUG FIX: connections.event_id was typed `text` while events.id is `uuid` —
-- the same mismatch fixed on rsvps in 20260617_8_fix_rsvps_event_id_type.sql.
-- Confirmed zero rows currently have event_id set (no data to migrate/clean),
-- no RLS policy on connections casts event_id, and no embedded PostgREST join
-- (connections?select=...,events(...)) exists in either client codebase, so
-- this hasn't broken anything yet — but it would the moment such a join or a
-- FK-dependent query was added, same as rsvps did.

alter table public.connections
  alter column event_id type uuid using event_id::uuid;

alter table public.connections
  add constraint connections_event_id_fkey foreign key (event_id)
  references public.events(id) on delete set null;
