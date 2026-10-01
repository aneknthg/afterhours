-- Extend is_test isolation (see 20260617_is_test_account_isolation.sql) to chat:
-- a test account's messages and poll votes never appear to other users, but
-- remain visible to the test account itself for QA verification. Also covers
-- Realtime postgres_changes subscriptions, which are evaluated against RLS.

drop policy if exists "Hide test-account messages from other users" on public.messages;
create policy "Hide test-account messages from other users" on public.messages
  as restrictive
  for select
  using (
    user_id = (select auth.uid())
    or not exists (
      select 1 from public.profiles p
      where p.id = messages.user_id and p.is_test
    )
  );

drop policy if exists "Hide test-account poll votes from other users" on public.poll_votes;
create policy "Hide test-account poll votes from other users" on public.poll_votes
  as restrictive
  for select
  using (
    user_id = (select auth.uid())
    or not exists (
      select 1 from public.profiles p
      where p.id = poll_votes.user_id and p.is_test
    )
  );
