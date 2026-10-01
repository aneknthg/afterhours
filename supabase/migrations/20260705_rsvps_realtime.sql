-- Enable realtime on the rsvps table so RSVP changes sync across screens/devices.
--
-- useRsvp (app + website) subscribes to postgres_changes on rsvps to keep the
-- "going" set in sync — most importantly, to drop an event's chat when its RSVP
-- is cancelled. That subscription was dead: rsvps wasn't in the supabase_realtime
-- publication (no events broadcast at all), and its replica identity was the
-- default (PK-only), so DELETE payloads carried no event_id for the handler to act on.
--
-- REPLICA IDENTITY FULL makes DELETE (and UPDATE) payloads include every column,
-- so payload.old.event_id is populated. Adding the table to the publication makes
-- the events actually broadcast. RLS still applies to realtime, so users only
-- receive changes to their own rsvp rows.

ALTER TABLE public.rsvps REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rsvps'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rsvps;
  END IF;
END $$;
