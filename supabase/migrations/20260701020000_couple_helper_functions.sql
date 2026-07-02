-- Helper functions shared by all couple_expenses RLS policies and RPCs.
-- All functions are SECURITY DEFINER and pin search_path = public
-- to prevent search_path injection.

-- ============================================================
-- 1. is_couple_expenses_enabled()
--    Returns true if the calling user has couple_expenses = true.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_couple_expenses_enabled()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((permissions->>'couple_expenses')::boolean, false) = true
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.is_couple_expenses_enabled() IS
  'Returns true if the calling user has the couple_expenses permission enabled.';

-- ============================================================
-- 2. is_in_connection(p_connection_id UUID)
--    Returns true if the caller is a member of the given ACTIVE
--    connection (revoked_at IS NULL).
--    Depends on couple_connections table (created in Phase 2).
--    Safe to define now; will resolve at runtime after Phase 2.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_in_connection(p_connection_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.couple_connections cc
    WHERE cc.id = p_connection_id
      AND cc.revoked_at IS NULL
      AND (cc.user_a = auth.uid() OR cc.user_b = auth.uid())
  );
END;
$$;

COMMENT ON FUNCTION public.is_in_connection(UUID) IS
  'Returns true if the caller is a member of the given active (non-revoked) couple connection.';

-- ============================================================
-- 3. is_in_connection_any(p_connection_id UUID)
--    Like is_in_connection() but includes revoked (archived) connections.
--    Used for read-only access to archived shared data.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_in_connection_any(p_connection_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.couple_connections cc
    WHERE cc.id = p_connection_id
      AND (cc.user_a = auth.uid() OR cc.user_b = auth.uid())
  );
END;
$$;

COMMENT ON FUNCTION public.is_in_connection_any(UUID) IS
  'Returns true if the caller is a member of the given couple connection (active or revoked).';

-- ============================================================
-- 4. find_user_by_couple_code(p_code TEXT)
--    Looks up a user_id by their couple_code.
--    Returns NULL if not found, if the caller does not have
--    couple_expenses enabled, or if the target does not have
--    couple_expenses enabled (anti-enumeration).
-- ============================================================
CREATE OR REPLACE FUNCTION public.find_user_by_couple_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_user_id UUID;
BEGIN
  -- Caller must have the feature enabled
  IF NOT public.is_couple_expenses_enabled() THEN
    RETURN NULL;
  END IF;

  -- Point lookup — no partial match, no list exposure
  SELECT p.user_id INTO v_target_user_id
  FROM public.profiles p
  WHERE p.couple_code = upper(trim(p_code))
    AND COALESCE((p.permissions->>'couple_expenses')::boolean, false) = true
  LIMIT 1;

  RETURN v_target_user_id; -- NULL if not found or target not enabled
END;
$$;

COMMENT ON FUNCTION public.find_user_by_couple_code(TEXT) IS
  'Resolves a couple_code to a user_id. Returns NULL if code does not exist, caller is not enabled, or target is not enabled. Anti-enumeration: returns only user_id, nothing else.';
