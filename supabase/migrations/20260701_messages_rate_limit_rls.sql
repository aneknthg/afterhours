-- SECURITY: messages_rate_limit was missing RLS, allowing any authenticated user to
-- read or write rate-limit records directly and bypass the per-user send quota.
-- Fix: enable RLS (default deny for all clients) and mark the trigger function
-- SECURITY DEFINER so it can still write to the table from within the user's session.

ALTER TABLE public.messages_rate_limit ENABLE ROW LEVEL SECURITY;

-- Re-declare with SECURITY DEFINER so the trigger runs as the postgres role and
-- can bypass RLS when recording rate-limit counts.
CREATE OR REPLACE FUNCTION public.moderate_message_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count int;
  window_ts timestamptz;
BEGIN
  -- SECURITY: reject empty messages
  IF trim(NEW.content) = '' THEN
    RAISE EXCEPTION 'empty';
  END IF;

  -- SECURITY: reject messages exceeding length limit
  IF length(NEW.content) > 1000 THEN
    RAISE EXCEPTION 'too long';
  END IF;

  -- SECURITY: reject blocked patterns (mirrors client-side BLOCKED_PATTERNS in chat.service.ts)
  IF NEW.content ~* '\b(whatsapp|telegram|signal)\b.*\d{7,}' OR
     NEW.content ~* '\d{10,}' OR
     NEW.content ~* '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' OR
     NEW.content ~* '\b(instagram|insta|ig)\s*[:/]?\s*@?[a-zA-Z0-9._]+' OR
     NEW.content ~* '\bhttps?://' THEN
    RAISE EXCEPTION 'community guidelines';
  END IF;

  -- SECURITY: per-user rate limit — max 30 messages per 60 seconds.
  -- Only counts new messages (INSERT); edits to existing messages don't consume quota.
  IF TG_OP = 'INSERT' THEN
    window_ts := date_trunc('minute', now());
    SELECT COALESCE(SUM(count), 0) INTO recent_count
    FROM public.messages_rate_limit
    WHERE user_id = NEW.user_id
      AND window_start >= now() - interval '60 seconds';

    IF recent_count >= 30 THEN
      RAISE EXCEPTION 'rate limit';
    END IF;

    INSERT INTO public.messages_rate_limit(user_id, window_start, count)
    VALUES (NEW.user_id, window_ts, 1)
    ON CONFLICT (user_id, window_start)
    DO UPDATE SET count = messages_rate_limit.count + 1;
  END IF;

  RETURN NEW;
END;
$$;
