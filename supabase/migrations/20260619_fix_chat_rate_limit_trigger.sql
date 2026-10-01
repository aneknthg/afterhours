-- SECURITY: moderate_message_content() previously fired on BEFORE INSERT OR UPDATE and
-- incremented the per-user rate limit on every fire. That meant editing an existing message
-- (chatService.editMessage / deleteOwnMessage, both UPDATEs) silently burned the sender's
-- 30-messages-per-60s send quota. Content moderation still needs to run on UPDATE (an edit
-- could otherwise be used to slip banned content past the filter), but the rate-limit counter
-- must only advance on actual new messages.

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

-- Keep firing on INSERT and UPDATE — content moderation still applies to edits,
-- the function itself now gates rate-limiting to TG_OP = 'INSERT'.
DROP TRIGGER IF EXISTS moderate_messages ON public.messages;
CREATE TRIGGER moderate_messages
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.moderate_message_content();

-- SECURITY: messages_rate_limit had no cleanup mechanism and grows unbounded — one row
-- per user per minute they sent a message, forever. Sweep rows older than the 60s window
-- (2 minute buffer) once a minute via pg_cron.
--
-- NOTE: if `CREATE EXTENSION pg_cron` fails when this migration is applied (it requires
-- elevated privileges some Supabase plans don't grant via migrations), enable pg_cron from
-- the Supabase Dashboard under Database → Extensions, then re-run just the cron.schedule
-- block below.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup-messages-rate-limit';

SELECT cron.schedule(
  'cleanup-messages-rate-limit',
  '* * * * *',
  $$DELETE FROM public.messages_rate_limit WHERE window_start < now() - interval '2 minutes'$$
);
