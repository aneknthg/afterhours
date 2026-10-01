-- Onboarding (commits 0d103a2, baa22bf, c53847a) reads/writes profiles.date_of_birth
-- and profiles.intent, but neither column was ever created. needsOnboarding() gates on
-- date_of_birth, so with the column absent it is always undefined → every user is forced
-- into onboarding forever, and finishing onboarding can't clear the gate because the
-- upsert of the missing columns fails. This migration adds the columns.
-- Safe to re-run; each statement is a no-op if the column already exists.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='date_of_birth') then
    alter table public.profiles add column date_of_birth date;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='intent') then
    alter table public.profiles add column intent text default '';
  end if;
end $$;
