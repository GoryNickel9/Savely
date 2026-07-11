-- ============================================================================
-- Active sessions — exposes auth.sessions to the current user via a
-- SECURITY DEFINER function, so the "Accessi attuali" UI can list every
-- device with an active session.
-- ============================================================================

-- The auth.sessions table is inaccessible directly from the client (auth
-- schema, no RLS).  This function acts as a read-only, user-scoped bridge.
create or replace function public.get_active_sessions()
returns table (
  id         uuid,
  created_at timestamptz,
  user_agent text,
  ip         inet
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.created_at, s.user_agent, s.ip
  from auth.sessions s
  where s.user_id = auth.uid()
    and (s.not_after is null or s.not_after > now())
  order by s.created_at desc;
$$;

-- Revoke from anon so the function is only callable by authenticated users.
revoke execute on function public.get_active_sessions from anon, public;
grant  execute on function public.get_active_sessions to   authenticated;
