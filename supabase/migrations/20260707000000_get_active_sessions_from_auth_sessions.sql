-- ============================================================================
-- Switches get_active_sessions() back to auth.sessions (the session ID is
-- required for per-device disconnection).  user_agent may be NULL for
-- sessions created by older GoTrue versions; the client handles that.
--
-- Also introduces delete_session() so the user can disconnect a single
-- device (not just "all others").
-- ============================================================================

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

create or replace function public.delete_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_session_id is null then
    raise exception 'Session ID is required';
  end if;

  delete from auth.sessions
  where id = p_session_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Session not found or access denied';
  end if;
end;
$$;

revoke execute on function public.get_active_sessions from anon, public;
grant  execute on function public.get_active_sessions to   authenticated;

revoke execute on function public.delete_session from anon, public;
grant  execute on function public.delete_session to   authenticated;
