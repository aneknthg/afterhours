-- BUGFIX: "restrict insert blocked from event host channels" checked channel against a
-- bare-UUID regex, but real event chat channels are always formatted `event-<uuid>`
-- (see app/chat/[id].tsx and app/(tabs)/chat.tsx, both build channel as `event-${id}`).
-- The regex never matched a real channel, so the policy's WITH CHECK always passed —
-- it never actually blocked anything in production. Found via /qa browser testing,
-- which sends messages through the real app code path instead of a synthetic channel value.

DROP POLICY IF EXISTS "restrict insert blocked from event host channels" ON public.messages;
CREATE POLICY "restrict insert blocked from event host channels"
ON public.messages
AS RESTRICTIVE
FOR INSERT
WITH CHECK (
  NOT (
    channel ~* '^event-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = substring(messages.channel from 7)::uuid
        AND public.is_blocked_by(e.creator_id, auth.uid())
    )
  )
);
