-- City-specific General chat
--
-- The single global "community-general" channel is replaced by one General
-- channel per city ("community-general-<city-slug>", e.g. community-general-hyderabad).
-- Membership is explicit and sticky: a user joins a city's General by tapping
-- "Join", and stays a member of every city she has joined even after she moves.
--
-- This migration:
--   1. Creates chat_channel_members to track who has joined which channel.
--   2. Deletes the old global General messages (we start each city fresh).

-- ── Membership table ────────────────────────────────────────────────────────
create table if not exists public.chat_channel_members (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  channel   text not null,
  joined_at timestamptz not null default now(),
  primary key (user_id, channel)
);

alter table public.chat_channel_members enable row level security;

-- A user can only see and manage her own memberships. Member *counts* shown in
-- the UI are derived from verified profiles per city (public_profiles view),
-- so we never need to expose other people's membership rows to the client.
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'chat_channel_members' and policyname = 'members read own') then
    create policy "members read own" on public.chat_channel_members
      for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'chat_channel_members' and policyname = 'members join self') then
    create policy "members join self" on public.chat_channel_members
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'chat_channel_members' and policyname = 'members leave self') then
    create policy "members leave self" on public.chat_channel_members
      for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ── Retire the old global General ───────────────────────────────────────────
-- Start each city's General fresh (chosen over migrating history).
delete from public.messages where channel = 'community-general';
