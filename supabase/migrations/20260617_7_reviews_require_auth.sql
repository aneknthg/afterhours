-- SECURITY FIX: reviews had `FOR SELECT USING (true)` — fully open, letting
-- anyone (no login required) dump the entire table via the REST API, exposing
-- every review's rating/text/tags and (when not anonymous) reviewer identity.
-- Confirmed anon had a SELECT grant with no other gating, same shape of issue
-- fixed for rsvps in 20260617_5_rsvps_require_auth.sql.
--
-- Every route that reads reviews (event detail, profile) is already behind
-- ProtectedRoute or otherwise expects a logged-in viewer in practice; the only
-- visible effect is that logged-out visitors no longer see reviews on a public
-- event/profile page.

drop policy if exists "Reviews are viewable by everyone" on public.reviews;
create policy "Authenticated users can view reviews" on public.reviews
  for select
  using ((select auth.uid()) is not null);
