-- Convert the remaining text-typed event_id columns to uuid + add FKs.
-- Same latent footgun that broke rsvps embedded joins (PGRST200) for every
-- user before 20260617_8_fix_rsvps_event_id_type.sql: PostgREST can't detect
-- relationships without a real FK, and text/uuid mismatches block adding one.
--
-- Pre-checked on prod 2026-07-10: all 5 tables have zero non-uuid values and
-- zero orphaned event_ids (bookmarks 0 rows, buddy_pings 15, event_views 0,
-- reports 0, reviews 3). connections/payments/rsvps/user_notifications are
-- already uuid. public.user_can_access_channel casts uuid->text, unaffected.
--
-- on delete: cascade for NOT NULL columns (row is meaningless without the
-- event), set null for nullable ones (keep the report/ping if event goes).

begin;

alter table public.bookmarks   alter column event_id type uuid using event_id::uuid;
alter table public.buddy_pings alter column event_id type uuid using event_id::uuid;
alter table public.event_views alter column event_id type uuid using event_id::uuid;
alter table public.reports     alter column event_id type uuid using event_id::uuid;
alter table public.reviews     alter column event_id type uuid using event_id::uuid;

alter table public.bookmarks   add constraint bookmarks_event_id_fkey   foreign key (event_id) references public.events(id) on delete cascade;
alter table public.buddy_pings add constraint buddy_pings_event_id_fkey foreign key (event_id) references public.events(id) on delete set null;
alter table public.event_views add constraint event_views_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade;
alter table public.reports     add constraint reports_event_id_fkey     foreign key (event_id) references public.events(id) on delete set null;
alter table public.reviews     add constraint reviews_event_id_fkey     foreign key (event_id) references public.events(id) on delete cascade;

commit;

-- PostgREST's schema cache can miss ALTER TYPE even with auto-reload — force it
-- (see the rsvps migration gotcha).
notify pgrst, 'reload schema';
