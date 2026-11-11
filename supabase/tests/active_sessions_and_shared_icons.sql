-- Run only against an empty disposable database: psql -v ON_ERROR_STOP=1 -f this-file.sql
-- All fixture objects and role grants are rolled back.
begin;
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql as $$ select current_setting('test.user_id')::uuid $$;
create table auth.sessions (
  id uuid primary key, user_id uuid not null, created_at timestamptz not null,
  user_agent text, ip inet, not_after timestamptz
);
create table public.login_activity (
  id uuid primary key, user_id uuid, session_id uuid, created_at timestamptz,
  event_type text, user_agent text, ip inet
);
set test.user_id = '11111111-1111-4111-8111-111111111111';
insert into auth.sessions values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', auth.uid(), now() - interval '60 days', 'same browser', null, null),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', auth.uid(), now(), 'same browser', null, null),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', auth.uid(), now(), null, null, null),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', auth.uid(), now(), 'expired', null, now() - interval '1 minute'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '22222222-2222-4222-8222-222222222222', now(), 'private', null, null);
insert into public.login_activity values
  ('aaaaaaaa-1111-4111-8111-111111111111', auth.uid(), 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', now(), 'sign_in', 'fallback browser', '127.0.0.1'),
  ('bbbbbbbb-1111-4111-8111-111111111111', auth.uid(), 'ffffffff-ffff-4fff-8fff-ffffffffffff', now(), 'sign_in', 'closed session', null);
\ir ../migrations/20261101090000_actual_active_sessions.sql
set local role authenticated;
do $$
begin
  if (select count(*) from public.get_active_sessions()) <> 3 then raise exception 'Session count or owner/expiry filtering failed'; end if;
  if (select count(*) from public.get_active_sessions() where user_agent = 'same browser') <> 2 then raise exception 'Identical browsers were merged'; end if;
  if not exists (select 1 from public.get_active_sessions() where created_at < now() - interval '30 days') then raise exception 'Long-lived session disappeared'; end if;
  if not exists (select 1 from public.get_active_sessions() where user_agent = 'fallback browser' and ip = '127.0.0.1'::inet) then raise exception 'Exact-session audit fallback failed'; end if;
  if exists (select 1 from public.get_active_sessions() where id <> session_id) then raise exception 'Session identifier mismatch'; end if;
end $$;
reset role;
do $$
begin
  if has_function_privilege('anon', 'public.get_active_sessions()', 'execute') then raise exception 'Anonymous execution was allowed'; end if;
end $$;

create table public.categories (id uuid primary key, user_id uuid, icon text, deleted_at timestamptz);
create table public.transactions (
  id uuid primary key, user_id uuid, category_id uuid, amount numeric(12,2), currency text,
  exchange_rate_eur numeric, description text, date date, deleted_at timestamptz
);
create table public.shared_expenses (
  id uuid, connection_id uuid, original_tx_id uuid, created_by uuid, couple_category_name text,
  split_mode text, partner_amount numeric(12,2), split_percentage numeric,
  created_at timestamptz, updated_at timestamptz
);
create function public.is_couple_expenses_enabled() returns boolean language sql as $$ select current_setting('test.couple_enabled')::boolean $$;
create function public.is_in_connection(connection_id uuid) returns boolean language sql as $$ select connection_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid $$;
set test.couple_enabled = 'true';
insert into public.categories values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', auth.uid(), 'food-icon', null);
insert into public.transactions values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', auth.uid(), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 100, 'EUR', 1, 'shared', current_date, null);
insert into public.shared_expenses values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', auth.uid(), 'Cibo', 'equal', null, 50, now(), now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', auth.uid(), 'Archived', 'equal', null, 50, now(), now());
\ir ../migrations/20261101091000_shared_expense_category_icon.sql
do $$
begin
  if (select count(*) from public.shared_expenses_view) <> 1 then raise exception 'Active connection filtering failed'; end if;
  if (select category_icon from public.shared_expenses_view) <> 'food-icon' then raise exception 'Source category icon missing'; end if;
  if (select partner_share_amount from public.shared_expenses_view) <> 50 then raise exception 'Existing split changed'; end if;
end $$;
update public.categories set deleted_at = now();
do $$
begin
  if not exists (select 1 from public.shared_expenses_view where category_icon is null) then raise exception 'Deleted category was exposed'; end if;
end $$;
set test.couple_enabled = 'false';
do $$
begin
  if exists (select 1 from public.shared_expenses_view) then raise exception 'Couple permission filtering failed'; end if;
end $$;
rollback;
\echo 'PASS: actual sessions, owner isolation, browser identity, expiry, grants, icons and shared-view privacy'
