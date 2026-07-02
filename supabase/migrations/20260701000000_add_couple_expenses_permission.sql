-- Backfill couple_expenses = false for all existing profiles.
-- New profiles will default to false because the trigger that populates
-- the permissions JSONB is already in place; we just add the key explicitly.

UPDATE public.profiles
SET permissions = COALESCE(permissions, '{}'::jsonb) || '{"couple_expenses": false}'::jsonb
WHERE permissions->>'couple_expenses' IS NULL;

COMMENT ON COLUMN public.profiles.permissions IS
  'JSONB field storing user permissions. Keys: admin, poker, fumo, statistics_deep_dive, fire, tcg, libreria, couple_expenses';
