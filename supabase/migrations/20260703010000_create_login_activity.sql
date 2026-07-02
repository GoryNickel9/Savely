-- ============================================================================
-- Login activity log + sessions visibility.
-- Tracks sign-in / sign-out / recovery / mfa_challenge events per user, written
-- client-side from useAuth's onAuthStateChange handler. IP is NULL client-side
-- (no edge-function enrichment in scope). User-agent is captured for device
-- recognition in the "Accessi recenti" UI.
-- ============================================================================

create table if not exists public.login_activity (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_type  text not null check (event_type in ('sign_in','sign_out','sign_up','recovery','mfa_challenge')),
  user_agent  text,
  ip          inet,
  created_at  timestamptz not null default now()
);

create index if not exists idx_login_activity_user_created
  on public.login_activity (user_id, created_at desc);

alter table public.login_activity enable row level security;

-- Users can read only their own login events.
drop policy if exists "la_select_own" on public.login_activity;
create policy "la_select_own" on public.login_activity
  for select using (auth.uid() = user_id);

-- Users can insert only their own login events (the client writes its own row).
drop policy if exists "la_insert_own" on public.login_activity;
create policy "la_insert_own" on public.login_activity
  for insert with check (auth.uid() = user_id);

-- No update / delete from clients: the log is append-only for audit purposes.
