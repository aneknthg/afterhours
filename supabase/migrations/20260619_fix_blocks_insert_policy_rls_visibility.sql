-- BUGFIX: "restrict insert blocked from event host channels" (20260619_blocks_enforce_messages_rls.sql)
-- joined public.blocks directly inside its WITH CHECK subquery. blocks' own RLS policy
-- ("Users manage own blocks": auth.uid() = blocker_id) only lets a user see rows where
-- THEY are the blocker, so the blocked user querying that subquery always gets zero rows
-- and the policy silently never fires. Same class of bug as is_test_profile() — fixed the
-- same way, with a SECURITY DEFINER helper that bypasses the nested RLS for this one check.

CREATE OR REPLACE FUNCTION public.is_blocked_by(p_blocker uuid, p_blocked uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE blocker_id = p_blocker AND blocked_id = p_blocked
  );
$function$;

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
      WHERE e.id = messages.channel::uuid
        AND public.is_blocked_by(e.creator_id, auth.uid())
    )
  )
);
