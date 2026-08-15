-- ============================================================================
-- E2E test user — ALREADY CREATED on this project via the Supabase Admin API.
--   email: e2e-savely@example.com  (→ GitHub secret E2E_USER_EMAIL)
--   password: stored in GitHub secret E2E_USER_PASSWORD
--   user_id: 9daffd41-39bf-4b1e-be68-abf12549c4a7
--
-- This user intentionally has NO module permissions (poker, fire, tcg, ...) so
-- that the route-guard tests can assert unauthorized redirects. If you want to
-- also run the FIRE E2E test, grant the `fire` permission (see step 3 below).
--
-- This file is kept for documentation / re-seeding purposes. The Admin API is
-- the recommended creation method because it correctly hashes the password with
-- GoTrue's expected format; a raw INSERT into auth.users may not.
-- ============================================================================

-- 1. Create the auth user (email/password). Adjust email/password as needed.
--    The password here is the SAME you put in the E2E_USER_PASSWORD secret.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'e2e-savely@example.com',                       -- → E2E_USER_EMAIL
  crypt('REPLACE_WITH_E2E_PASSWORD', gen_salt('bf')), -- → E2E_USER_PASSWORD
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"E2E Test User"}'::jsonb
)
on conflict (email) do nothing;

-- 2. Ensure a profile row exists with no module permissions (defaults).
--    The handle_new_user() trigger usually creates this, but we make it idempotent.
insert into public.profiles (user_id, full_name, permissions)
select id, 'E2E Test User', '{}'::jsonb
from auth.users
where email = 'e2e-savely@example.com'
on conflict (user_id) do update
  set permissions = excluded.permissions;

-- 3. (Optional) Grant the `fire` permission to run the FIRE E2E test.
--    Uncomment to enable the /fire E2E spec.
-- update public.profiles
-- set permissions = permissions || '{"fire": true}'::jsonb
-- where user_id = (select id from auth.users where email = 'e2e-savely@example.com');
