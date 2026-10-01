-- Add identity verification columns to profiles
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'profiles' and column_name = 'verification_status'
  ) then
    alter table public.profiles
      add column verification_status text not null default 'unverified'
        check (verification_status in ('unverified', 'pending', 'verified', 'failed'));
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'profiles' and column_name = 'verification_at'
  ) then
    alter table public.profiles add column verification_at timestamptz;
  end if;
end $$;
