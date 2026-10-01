-- Extend is_test isolation (see 20260617_is_test_account_isolation.sql and
-- 20260617_4_fix_test_isolation_rls_bypass.sql) to connections and reviews.
--
-- Audit findings:
-- - chat_channel_members: already isolated. Its base SELECT policy
--   ("members read own") restricts every user to their own row, so no
--   restrictive policy is needed there.
-- - connections: the base policy makes any ACCEPTED connection visible to
--   every authenticated user, not just the two parties. If the test account
--   forms an accepted connection with a real user, that row currently leaks
--   to everyone.
-- - reviews: the base policy is USING (true) — every review is visible to
--   everyone, including anon. A review written by the test account on a
--   real event currently leaks.
--
-- Both new policies use the public.is_test_profile() SECURITY DEFINER helper
-- (not a direct profiles subquery) per the bypass bug fixed in
-- 20260617_4_fix_test_isolation_rls_bypass.sql. Row owners/parties can always
-- see their own rows so the test account can still verify its own QA data.

drop policy if exists "Hide test-account connections from other users" on public.connections;
create policy "Hide test-account connections from other users" on public.connections
  as restrictive
  for select
  using (
    requester_id = (select auth.uid())
    or target_id = (select auth.uid())
    or (
      not public.is_test_profile(requester_id)
      and not public.is_test_profile(target_id)
    )
  );

drop policy if exists "Hide test-account reviews from other users" on public.reviews;
create policy "Hide test-account reviews from other users" on public.reviews
  as restrictive
  for select
  using (
    user_id = (select auth.uid())
    or not public.is_test_profile(user_id)
  );
