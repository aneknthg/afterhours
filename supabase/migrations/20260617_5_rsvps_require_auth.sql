-- SECURITY FIX: rsvps had `FOR SELECT USING (true)` — fully open, letting anyone
-- (no login required) dump the entire table via the REST API, exposing every real
-- user's user_id-to-event_id RSVP history. Confirmed via raw anon REST call.
--
-- Every route in the app that reads rsvps is already gated behind ProtectedRoute,
-- which redirects to /auth whenever there's no logged-in user — regardless of its
-- requireVerification/requireOnboarding flags. The one exception is the public
-- /profile/:id page (PublicProfile.jsx), which shows a user's past events to
-- anyone, logged in or not, if she's opted in via privacy settings. Restricting to
-- authenticated-only (matching the existing `messages` table policy) closes the
-- anonymous bulk-dump hole; the only visible effect is that anonymous (logged-out)
-- visitors to a public profile no longer see that section — logged-in visitors
-- still do, and nothing else in the app breaks since it's all already auth-gated.

drop policy if exists "RSVPs are viewable by everyone" on public.rsvps;
create policy "Authenticated users can view rsvps" on public.rsvps
  for select
  using ((select auth.uid()) is not null);
