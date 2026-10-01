-- Fix: profiles.verified_at was never written. The verify-identity edge function
-- set verification_at (which nothing reads), while trust.service reads verified_at
-- (which nothing wrote) — so verified_at was NULL for every row, including verified
-- users. Going forward the edge function writes verified_at; this migration
-- declares the column and backfills existing verified users from verification_at.
--
-- NON-DESTRUCTIVE: only adds a column and fills NULLs. No data is dropped here.
-- The deprecated verification_at column is intentionally NOT dropped in this file;
-- that destructive step is in the documented plan and must be run separately.

-- 1. Ensure the canonical column exists (no-op if already present in prod).
alter table public.profiles add column if not exists verified_at timestamptz;

-- 2. Backfill: copy the old timestamp into verified_at for already-verified rows
--    that have one. Only touches rows where verified_at is currently NULL, so it is
--    idempotent and safe to re-run.
--    IMPORTANT: the prod trigger guard_profile_trust_cols() reverts verified_at
--    based on the app.bypass_trust_guard GUC, NOT on the connection role. A plain
--    UPDATE here (even as postgres) would be reverted, leaving verified_at NULL.
--    Set the bypass GUC for this transaction so the backfill actually persists.
select set_config('app.bypass_trust_guard', 'on', true);

update public.profiles
set    verified_at = verification_at
where  verification_status = 'verified'
  and  verified_at is null
  and  verification_at is not null;

select set_config('app.bypass_trust_guard', 'off', true);

-- NOTE: verified rows where verification_at is also NULL (e.g. verified via a path
-- that never recorded a timestamp) cannot be backfilled accurately and are left NULL
-- rather than fabricating a date. Query them with:
--   select id from public.profiles
--   where verification_status = 'verified' and verified_at is null;
