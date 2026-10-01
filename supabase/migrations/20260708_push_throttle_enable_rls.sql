-- SECURITY: push_throttle had RLS disabled, so anyone with the project URL + anon
-- key could read/edit/delete it (Supabase advisor: rls_disabled_in_public).
--
-- The table is server-side only: it is created and read/written exclusively by the
-- notify-chat edge function (which uses SUPABASE_SERVICE_ROLE_KEY) and cleared by the
-- delete_user_account RPC (SECURITY DEFINER). Both bypass RLS, so enabling RLS with
-- NO policies closes the public hole without affecting any legitimate access.
alter table public.push_throttle enable row level security;
