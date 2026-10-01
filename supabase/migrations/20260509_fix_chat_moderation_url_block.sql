-- Fix 1: overly broad URL block — replace all-URL block with targeted contact-app URLs only.
-- Fix 2: rate limit used NEW.user_id (client-supplied) instead of auth.uid() (authoritative).
--        Also enforce NEW.user_id = auth.uid() so a message can never be attributed to
--        another user even if someone hits the Supabase API directly.

CREATE OR REPLACE FUNCTION public.moderate_message_content()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  recent_count int;
  window_ts timestamptz;
  uid uuid := auth.uid();
BEGIN
  -- Reject unauthenticated inserts and enforce user_id cannot be spoofed
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  NEW.user_id := uid;

  -- Reject empty messages
  IF trim(NEW.content) = '' THEN
    RAISE EXCEPTION 'empty';
  END IF;

  -- Reject messages exceeding length limit
  IF length(NEW.content) > 1000 THEN
    RAISE EXCEPTION 'too long';
  END IF;

  -- Reject contact-solicitation patterns
  IF NEW.content ~* '\b(whatsapp|telegram|signal)\b.*\d{7,}' OR
     NEW.content ~* '\d{10,}' OR
     NEW.content ~* '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' OR
     NEW.content ~* '\b(instagram|insta|ig)\s*[:/]?\s*@?[a-zA-Z0-9._]+' OR
     NEW.content ~* '\bhttps?://(t\.me|telegram\.me)/' THEN
    RAISE EXCEPTION 'community guidelines';
  END IF;

  -- Per-user rate limit — max 30 messages per 60 seconds, keyed on auth.uid()
  window_ts := date_trunc('minute', now());
  SELECT COALESCE(SUM(count), 0) INTO recent_count
  FROM public.messages_rate_limit
  WHERE user_id = uid
    AND window_start >= now() - interval '60 seconds';

  IF recent_count >= 30 THEN
    RAISE EXCEPTION 'rate limit';
  END IF;

  INSERT INTO public.messages_rate_limit(user_id, window_start, count)
  VALUES (uid, window_ts, 1)
  ON CONFLICT (user_id, window_start)
  DO UPDATE SET count = messages_rate_limit.count + 1;

  RETURN NEW;
END;
$$;
