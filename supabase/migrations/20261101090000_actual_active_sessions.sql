-- Keep one row per live auth session, including sessions older than 30 days.
-- Audit metadata is only a fallback for the exact same session identifier.
create or replace function public.get_active_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  user_agent text,
  ip inet,
  session_id uuid
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.created_at,
    coalesce(nullif(s.user_agent, ''), la.user_agent),
    coalesce(s.ip, la.ip), s.id
  from auth.sessions s
  left join lateral (
    select a.user_agent, a.ip
    from public.login_activity a
    where a.user_id = s.user_id and a.session_id = s.id
      and a.event_type = 'sign_in'
    order by a.created_at desc, a.id
    limit 1
  ) la on true
  where s.user_id = auth.uid()
    and (s.not_after is null or s.not_after > now())
  order by s.created_at desc, s.id;
$$;

revoke execute on function public.get_active_sessions() from anon, public;
grant execute on function public.get_active_sessions() to authenticated;
