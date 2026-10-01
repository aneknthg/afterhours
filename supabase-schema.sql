-- ══════════════════════════════════════════════════════════════
-- Afterhours — Supabase Database Schema
-- ══════════════════════════════════════════════════════════════
-- Run this in your Supabase dashboard: SQL Editor > New Query > Paste > Run
-- This creates all tables needed for Phase 1

-- ── Profiles (extends Supabase auth.users) ──────────────────
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text not null default '',
  role text default '',
  bio text default '',
  avatar_url text default '',
  city text default '',
  country text default '',
  hobbies text[] default '{}',
  date_of_birth date,
  intent text default '',
  privacy_settings jsonb default '{}'::jsonb,
  buddy_system boolean default false,
  safety_checkins boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Migration: add columns that may be missing from existing deployments ──────
-- Safe to re-run; each statement is a no-op if the column already exists.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='city') then
    alter table public.profiles add column city text default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='country') then
    alter table public.profiles add column country text default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='hobbies') then
    alter table public.profiles add column hobbies text[] default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='date_of_birth') then
    alter table public.profiles add column date_of_birth date;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='intent') then
    alter table public.profiles add column intent text default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='privacy_settings') then
    alter table public.profiles add column privacy_settings jsonb default '{}'::jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='buddy_system') then
    alter table public.profiles add column buddy_system boolean default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='safety_checkins') then
    alter table public.profiles add column safety_checkins boolean default false;
  end if;
end $$;

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Events ──────────────────────────────────────────────────
create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  creator_id uuid references public.profiles(id) on delete set null,
  title text not null,
  category text not null default 'other',
  venue text not null default '',
  date text not null default '',
  city text not null default '',
  end_time text default '',
  price text default 'Free',
  tag text default '',
  description text default '',
  extras text default '',
  capacity int default null,
  access text default 'open',
  image_url text default '',
  is_curated boolean default false,
  created_at timestamptz default now()
);

-- ── RSVPs (who is attending what) ───────────────────────────
create table if not exists public.rsvps (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  event_id uuid references public.events(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, event_id)
);

-- ── Chat messages ───────────────────────────────────────────
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  channel text not null,
  user_id uuid references public.profiles(id) on delete set null,
  display_name text not null default 'Anonymous',
  content text not null,
  created_at timestamptz default now()
);

-- ── Row Level Security ──────────────────────────────────────
-- Profiles: anyone can read, only owner can update
alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Events: anyone can read, authenticated users can create
alter table public.events enable row level security;

create policy "Events are viewable by everyone"
  on public.events for select using (true);

create policy "Authenticated users can create events"
  on public.events for insert with check (auth.uid() is not null);

create policy "Creators can update their own events"
  on public.events for update using (auth.uid() = creator_id);

-- RSVPs: anyone can see, authenticated users can manage their own
alter table public.rsvps enable row level security;

create policy "RSVPs are viewable by everyone"
  on public.rsvps for select using (true);

create policy "Users can RSVP"
  on public.rsvps for insert with check (auth.uid() = user_id);

create policy "Users can remove their own RSVP"
  on public.rsvps for delete using (auth.uid() = user_id);

-- Messages: anyone can read, authenticated users can send
alter table public.messages enable row level security;

create policy "Messages are viewable by everyone"
  on public.messages for select using (true);

create policy "Authenticated users can send messages"
  on public.messages for insert with check (auth.uid() is not null);

-- ── Enable Realtime for chat messages ───────────────────────
alter publication supabase_realtime add table public.messages;

-- ── User notifications (e.g. RSVP approved) ─────────────────
create table if not exists public.user_notifications (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  type       text not null,  -- 'rsvp_approved' | 'rsvp_rejected'
  event_id   uuid references public.events(id) on delete cascade,
  event_title text default '',
  read       boolean default false,
  created_at timestamptz default now()
);

alter table public.user_notifications enable row level security;
create policy "Users see their own notifications"
  on public.user_notifications for select using (auth.uid() = user_id);
create policy "Service can insert notifications"
  on public.user_notifications for insert with check (true);
create policy "Users can mark their own notifications read"
  on public.user_notifications for update using (auth.uid() = user_id);

-- ── Migration: add missing columns to existing tables ────────
do $$ begin
  -- rsvps: status column for approval flow
  if not exists (select 1 from information_schema.columns where table_name='rsvps' and column_name='status') then
    alter table public.rsvps add column status text default 'approved';
  end if;
  -- reviews: anonymous flag
  if not exists (select 1 from information_schema.columns where table_name='reviews' and column_name='anonymous') then
    alter table public.reviews add column anonymous boolean default false;
  end if;
  -- Identity verification (Amazon Rekognition)
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='verification_status') then
    alter table public.profiles
      add column verification_status text not null default 'unverified'
        check (verification_status in ('unverified', 'pending', 'verified', 'failed'));
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='verification_at') then
    alter table public.profiles add column verification_at timestamptz;
  end if;
  -- Canonical verification timestamp (read by trust.service). verification_at is
  -- the deprecated alias kept above for transition; see 20260605 migration.
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='verified_at') then
    alter table public.profiles add column verified_at timestamptz;
  end if;
  -- Set by the Rekognition edge function ('Male'/'Female'); kept server-side only.
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='gender') then
    alter table public.profiles add column gender text;
  end if;
  -- Timestamp of SMS phone verification (read by trust.service).
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='phone_verified_at') then
    alter table public.profiles add column phone_verified_at timestamptz;
  end if;
end $$;
