-- SECURITY: complete account deletion in one atomic transaction; client-side partial deletes left orphaned rows
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Delete all user data atomically
  DELETE FROM public.messages WHERE user_id = uid;
  DELETE FROM public.events WHERE creator_id = uid;
  DELETE FROM public.connections WHERE requester_id = uid OR target_id = uid;

  BEGIN DELETE FROM public.buddies WHERE user_id = uid;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN DELETE FROM public.buddy_pings WHERE user_id = uid;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN DELETE FROM public.bookmarks WHERE user_id = uid;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN DELETE FROM public.reports WHERE reporter_id = uid OR reported_user_id = uid;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN DELETE FROM public.reviews WHERE user_id = uid;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN DELETE FROM public.event_views WHERE user_id = uid;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN DELETE FROM public.push_tokens WHERE user_id = uid;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN DELETE FROM public.user_notifications WHERE user_id = uid;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  BEGIN DELETE FROM public.blocks WHERE blocker_id = uid OR blocked_id = uid;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  DELETE FROM public.rsvps WHERE user_id = uid;
  DELETE FROM public.profiles WHERE id = uid;

  -- SECURITY: delete auth.users last so auth.uid() is still valid throughout
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

-- SECURITY: only signed-in users can delete their own account
REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
