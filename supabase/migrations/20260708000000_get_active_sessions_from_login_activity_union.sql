-- ============================================================================
-- get_active_sessions() now reads from login_activity + optionally joins
-- auth.sessions so the UI can show devices and allow per-device disconnection.
--
-- Problem: auth.sessions often contains only the current session, but
-- login_activity captures every sign_in reliably.  We show recent sign_ins
-- (30-day window) and try to match each one to an auth session by user_agent.
-- ============================================================================

drop function if exists public.get_active_sessions();

create function public.get_active_sessions()
returns table (
  id         uuid,
  created_at timestamptz,
  user_agent text,
  ip         inet,
  session_id uuid
)
language sql
security definer
set search_path = public
as $$
  select distinct on (la.user_agent)
    la.id,
    la.created_at,
    la.user_agent,
    la.ip,
    s.id as session_id
  from public.login_activity la
  left join auth.sessions s
    on s.user_agent = la.user_agent
    and s.user_id = auth.uid()
    and (s.not_after is null or s.not_after > now())
  where la.user_id = auth.uid()
    and la.event_type = 'sign_in'
    and la.user_agent is not null
    and la.created_at > now() - interval '30 days'
  order by la.user_agent, la.created_at desc;
$$;

revoke execute on function public.get_active_sessions from anon, public;
grant  execute on function public.get_active_sessions to   authenticated;
