-- Enforce ownership on the connections table so no authenticated user can
-- accept, reject, or delete a connection they are not party to.

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- Drop any broad legacy policies before recreating precise ones
DROP POLICY IF EXISTS "Users can view their own connections" ON public.connections;
DROP POLICY IF EXISTS "Users can manage their connections"  ON public.connections;
DROP POLICY IF EXISTS "Authenticated users can read connections" ON public.connections;

-- SELECT: signed-in users can see accepted connections (needed for profile sidebars);
-- pending/rejected rows are private to the two parties only.
-- anon visitors cannot read any connection rows.
CREATE POLICY "Authenticated users can view accepted connections"
  ON public.connections FOR SELECT
  USING (
    (status = 'accepted' AND auth.role() = 'authenticated')
    OR auth.uid() = requester_id
    OR auth.uid() = target_id
  );

-- INSERT: you can only open a request as yourself
CREATE POLICY "Users can send connection requests as themselves"
  ON public.connections FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

-- UPDATE: target accepts/rejects; requester can re-send after a removal (upsert)
CREATE POLICY "Parties can update their connections"
  ON public.connections FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- DELETE: either party can dissolve the connection
CREATE POLICY "Either party can remove a connection"
  ON public.connections FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = target_id);
