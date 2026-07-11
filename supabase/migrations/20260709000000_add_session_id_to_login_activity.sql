-- ============================================================================
-- Add session_id column to login_activity so we can disconnect a single
-- device rather than all other sessions at once.
-- ============================================================================

alter table public.login_activity
  add column if not exists session_id uuid;

create index if not exists idx_login_activity_session_id
  on public.login_activity (session_id);

-- Rebuild get_active_sessions() to use the stored session_id
-- instead of the unreliable user_agent-based join with auth.sessions.
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
    la.session_id
  from public.login_activity la
  where la.user_id = auth.uid()
    and la.event_type = 'sign_in'
    and la.user_agent is not null
    and la.created_at > now() - interval '30 days'
  order by la.user_agent, la.created_at desc;
$$;

revoke execute on function public.get_active_sessions from anon, public;
grant  execute on function public.get_active_sessions to   authenticated;
