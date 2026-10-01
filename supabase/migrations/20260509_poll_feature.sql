-- Add poll JSONB column to messages for WhatsApp-style polls
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS poll JSONB;

-- Votes table: one row per (message, user, option)
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   uuid        NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  option_index int         NOT NULL CHECK (option_index >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, option_index)
);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all votes (needed for progress bars / counts)
CREATE POLICY "Authenticated users can view poll votes"
  ON public.poll_votes FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can cast their own votes
CREATE POLICY "Users can vote on polls"
  ON public.poll_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can retract their own votes
CREATE POLICY "Users can remove their votes"
  ON public.poll_votes FOR DELETE
  USING (auth.uid() = user_id);
