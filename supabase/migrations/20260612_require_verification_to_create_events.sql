-- Require identity verification to host (create) an event.
--
-- Root cause: the original INSERT policy (20260505_optimize_rls_policies.sql) only
-- checked that the caller was authenticated:
--
--     FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL)
--
-- Two gaps:
--   1. No verification check. Verification was enforced ONLY client-side by
--      ProtectedRoute (App.jsx). Any authenticated user — verified or not — could
--      POST straight to the REST API and create an event, bypassing the React guard.
--      This is also how an unverified host keeps a live event after changing their
--      DP (which intentionally drops verification, see
--      20260609_reset_verification_on_avatar_change.sql).
--   2. creator_id was never tied to auth.uid(), so a caller could insert an event
--      attributed to a DIFFERENT user.
--
-- Fix: the INSERT must be the caller's own row AND the caller's profile must be
-- 'verified'. Uses the same EXISTS-on-profiles pattern already used by the admin
-- policies in 20260505_optimize_rls_policies.sql (lines 69, 115), so no new RLS
-- recursion risk — a user can always read their own profile row.
--
-- Scope (decided with the product owner): gate CREATION only. Events created while
-- the host was verified stay live even if the host later loses verification, so
-- attendees who already RSVP'd are not stranded mid-lifecycle.

DROP POLICY IF EXISTS "Authenticated users can create events" ON public.events;

CREATE POLICY "Verified users can create their own events" ON public.events
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = creator_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND verification_status = 'verified'
    )
  );
