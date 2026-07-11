-- ============================================================================
-- Replaces get_active_sessions() to query login_activity instead of
-- auth.sessions.  Some Supabase/GoTrue instances do not populate user_agent
-- in auth.sessions, making it impossible to show device info.
--
-- The new implementation deduplicates by user_agent:
--   1. For each user_agent, find the latest event.
--   2. Keep only those whose latest event is a sign_in (excludes signed-out
--      devices).
--   3. Returns id, created_at, user_agent, ip — same schema as before so the
--      client hook needs no changes.
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
  with latest_per_device as (
    select distinct on (la.user_agent) la.id, la.user_agent, la.created_at, la.ip, la.event_type
    from public.login_activity la
    where la.user_id = auth.uid()
      and la.user_agent is not null
    order by la.user_agent, la.created_at desc
  )
  select lpd.id, lpd.created_at, lpd.user_agent, lpd.ip
  from latest_per_device lpd
  where lpd.event_type = 'sign_in'
  order by lpd.created_at desc;
$$;
