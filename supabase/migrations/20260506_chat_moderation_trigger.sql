-- SECURITY: server-side content moderation so clients cannot bypass by hitting Supabase API directly

-- Rate limit table
CREATE TABLE IF NOT EXISTS public.messages_rate_limit (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, window_start)
);

-- Index for efficient rate limit lookups
CREATE INDEX IF NOT EXISTS idx_messages_user_created ON public.messages(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.moderate_message_content()
RETURNS trigger
LANGUAGE plpgsql
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

  -- SECURITY: reject blocked patterns (mirrors client-side BLOCKED_PATTERNS in chat.service.js)
  IF NEW.content ~* '\b(whatsapp|telegram|signal)\b.*\d{7,}' OR
     NEW.content ~* '\d{10,}' OR
     NEW.content ~* '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' OR
     NEW.content ~* '\b(instagram|insta|ig)\s*[:/]?\s*@?[a-zA-Z0-9._]+' OR
     NEW.content ~* '\bhttps?://' THEN
    RAISE EXCEPTION 'community guidelines';
  END IF;

  -- SECURITY: per-user rate limit — max 30 messages per 60 seconds
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS moderate_messages ON public.messages;
CREATE TRIGGER moderate_messages
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.moderate_message_content();
