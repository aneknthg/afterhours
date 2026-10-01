-- SECURITY: the `blocks` table already exists and is used client-side (lib/trust.service.ts)
-- to grey out/hide blocked users in the UI, but nothing previously stopped a blocked user's
-- messages from being fetched by the blocked party's client, or from being posted into a
-- channel owned by the person who blocked them. These are RESTRICTIVE policies, which AND
-- with whatever permissive SELECT/INSERT policies already exist on messages — they only
-- narrow access, they cannot grant any access on their own.

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restrict select hide blocked senders" ON public.messages;
CREATE POLICY "restrict select hide blocked senders"
ON public.messages
AS RESTRICTIVE
FOR SELECT
USING (
  NOT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE blocker_id = auth.uid()
      AND blocked_id = messages.user_id
  )
);

-- `messages.channel` is the event id (as text) for event-specific circles, or a non-uuid
-- string (e.g. "general-hyderabad") for city-wide general chat. Only enforce the event-host
-- block check when the channel actually resolves to an event.
DROP POLICY IF EXISTS "restrict insert blocked from event host channels" ON public.messages;
CREATE POLICY "restrict insert blocked from event host channels"
ON public.messages
AS RESTRICTIVE
FOR INSERT
WITH CHECK (
  NOT (
    channel ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.blocks bl ON bl.blocker_id = e.creator_id
      WHERE e.id = messages.channel::uuid
        AND bl.blocked_id = auth.uid()
    )
  )
);
