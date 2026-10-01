-- SECURITY: overwrite client-supplied display_name with the real profile name to prevent impersonation
CREATE OR REPLACE FUNCTION public.enforce_message_display_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- SECURITY: always pull display_name from profiles, ignore what client sent
  NEW.display_name := COALESCE(
    (SELECT display_name FROM public.profiles WHERE id = NEW.user_id),
    'Anonymous'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_display_name ON public.messages;
CREATE TRIGGER enforce_display_name
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_display_name();
