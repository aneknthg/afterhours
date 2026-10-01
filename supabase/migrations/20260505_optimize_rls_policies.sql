-- =====================================================
-- OPTIMIZE RLS POLICIES: replace auth.uid() with (SELECT auth.uid())
-- Prevents per-row auth evaluation — evaluated once per query instead.
-- =====================================================

-- blocks
DROP POLICY IF EXISTS "Users manage own blocks" ON public.blocks;
CREATE POLICY "Users manage own blocks" ON public.blocks
  FOR ALL USING ((SELECT auth.uid()) = blocker_id);

-- bookmarks
DROP POLICY IF EXISTS "Users manage own bookmarks" ON public.bookmarks;
CREATE POLICY "Users manage own bookmarks" ON public.bookmarks
  FOR ALL USING ((SELECT auth.uid()) = user_id);

-- buddies
DROP POLICY IF EXISTS "Users manage own buddies" ON public.buddies;
CREATE POLICY "Users manage own buddies" ON public.buddies
  FOR ALL USING ((SELECT auth.uid()) = user_id);

-- buddy_pings
DROP POLICY IF EXISTS "Users can delete own pings" ON public.buddy_pings;
CREATE POLICY "Users can delete own pings" ON public.buddy_pings
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own pings" ON public.buddy_pings;
CREATE POLICY "Users can insert own pings" ON public.buddy_pings
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own pings" ON public.buddy_pings;
CREATE POLICY "Users can update own pings" ON public.buddy_pings
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own pings" ON public.buddy_pings;
CREATE POLICY "Users can view own pings" ON public.buddy_pings
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- connections
DROP POLICY IF EXISTS "Users manage own connections" ON public.connections;
CREATE POLICY "Users manage own connections" ON public.connections
  FOR ALL USING ((SELECT auth.uid()) = requester_id OR (SELECT auth.uid()) = target_id);

-- event_views
DROP POLICY IF EXISTS "Users can log own event views" ON public.event_views;
CREATE POLICY "Users can log own event views" ON public.event_views
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own event views" ON public.event_views;
CREATE POLICY "Users can view own event views" ON public.event_views
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- events
DROP POLICY IF EXISTS "Authenticated users can create events" ON public.events;
CREATE POLICY "Authenticated users can create events" ON public.events
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Creators can update their own events" ON public.events;
CREATE POLICY "Creators can update their own events" ON public.events
  FOR UPDATE USING ((SELECT auth.uid()) = creator_id);

DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;
CREATE POLICY "Events are viewable by everyone" ON public.events
  FOR SELECT USING (true);

-- message_reports
DROP POLICY IF EXISTS "Admins can read message reports" ON public.message_reports;
CREATE POLICY "Admins can read message reports" ON public.message_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "Users can file message reports" ON public.message_reports;
CREATE POLICY "Users can file message reports" ON public.message_reports
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- messages
DROP POLICY IF EXISTS "Members can post to channels as themselves" ON public.messages;
CREATE POLICY "Members can post to channels as themselves" ON public.messages
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Members can read channel messages" ON public.messages;
CREATE POLICY "Members can read channel messages" ON public.messages
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages" ON public.messages
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
CREATE POLICY "Users can update their own messages" ON public.messages
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

-- profiles
DROP POLICY IF EXISTS "Profile rows readable by anyone authed" ON public.profiles;
CREATE POLICY "Profile rows readable by anyone authed" ON public.profiles
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update their own profile (safe cols)" ON public.profiles;
CREATE POLICY "Users can update their own profile (safe cols)" ON public.profiles
  FOR UPDATE USING ((SELECT auth.uid()) = id);

-- push_tokens
DROP POLICY IF EXISTS "Users manage own tokens" ON public.push_tokens;
CREATE POLICY "Users manage own tokens" ON public.push_tokens
  FOR ALL USING ((SELECT auth.uid()) = user_id);

-- reports
DROP POLICY IF EXISTS "Admins can read reports" ON public.reports;
CREATE POLICY "Admins can read reports" ON public.reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
CREATE POLICY "Users can create reports" ON public.reports
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- reviews
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
CREATE POLICY "Reviews are viewable by everyone" ON public.reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can write reviews" ON public.reviews;
CREATE POLICY "Users can write reviews" ON public.reviews
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- rsvps
DROP POLICY IF EXISTS "Hosts can delete rsvps on their events" ON public.rsvps;
CREATE POLICY "Hosts can delete rsvps on their events" ON public.rsvps
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.events WHERE id::text = rsvps.event_id AND creator_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Hosts can update rsvps on their events" ON public.rsvps;
CREATE POLICY "Hosts can update rsvps on their events" ON public.rsvps
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.events WHERE id::text = rsvps.event_id AND creator_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "RSVPs are viewable by everyone" ON public.rsvps;
CREATE POLICY "RSVPs are viewable by everyone" ON public.rsvps
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can remove their own RSVP" ON public.rsvps;
CREATE POLICY "Users can remove their own RSVP" ON public.rsvps
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can RSVP" ON public.rsvps;
CREATE POLICY "Users can RSVP" ON public.rsvps
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- user_notifications
DROP POLICY IF EXISTS "Service can insert notifications" ON public.user_notifications;
CREATE POLICY "Service can insert notifications" ON public.user_notifications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can mark their own notifications read" ON public.user_notifications;
CREATE POLICY "Users can mark their own notifications read" ON public.user_notifications
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users see their own notifications" ON public.user_notifications;
CREATE POLICY "Users see their own notifications" ON public.user_notifications
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
