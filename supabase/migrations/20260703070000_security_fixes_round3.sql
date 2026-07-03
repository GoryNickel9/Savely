-- ============================================================================
-- Security fixes — Round 3 (2026-07-03).
-- Addresses findings SEC-01..SEC-05 of plans/AUDIT_SICUREZZA_ROUND3_2026-07-03.md.
--
-- SEC-01 (CRITICAL): IDOR via net-worth RPC.
-- SEC-02 (HIGH):     shared_expenses_view regression (is_in_connection_any).
-- SEC-03 (MEDIUM):   is_admin() SECURITY DEFINER without SET search_path.
-- SEC-04 (MEDIUM):   admin UPDATE policy on profiles missing WITH CHECK.
-- SEC-05 (LOW):      login_activity.user_agent client-controlled, no length cap.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- SEC-01: net-worth functions must not be callable by arbitrary users via RPC.
-- They run as SECURITY DEFINER and accept a p_user_id, so without guards + a
-- REVOKE, any authenticated user could compute another user's net worth.
--
-- Fix:
--   1. REVOKE EXECUTE FROM anon, authenticated so PostgREST does not expose
--      them. The pg_cron job (snapshot-net-worth-daily) runs as the `postgres`
--      superuser, which bypasses privilege checks, so it keeps working.
--   2. Defense-in-depth: inside each function that takes p_user_id, raise if the
--      caller is a non-admin user different from p_user_id. We only enforce
--      when auth.uid() IS NOT NULL, so the cron job (auth.uid() = NULL) is
--      unaffected.
-- ----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.compute_net_worth_at(UUID, DATE)        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.snapshot_net_worth_for_user(UUID)       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.snapshot_net_worth_all()                FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.backfill_net_worth_for_user(UUID, DATE) FROM anon, authenticated;


-- compute_net_worth_at: add the auth guard.
CREATE OR REPLACE FUNCTION public.compute_net_worth_at(
  p_user_id UUID,
  p_date    DATE
)
RETURNS TABLE(net_worth DECIMAL, cashflow DECIMAL, portfolio_pl DECIMAL, real_estate_discounted DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cashflow DECIMAL(15,2);
  v_portfolio_pl DECIMAL(15,2) := 0;
  v_real_estate_value DECIMAL(15,2) := 0;
  v_real_estate_discounted DECIMAL(15,2) := 0;
  v_asset RECORD;
  v_hist_price NUMERIC;
BEGIN
  -- SEC-01 guard: only the owner or an admin may compute another user's net
  -- worth. Skip when there is no auth context (cron/superuser).
  IF auth.uid() IS NOT NULL
     AND p_user_id IS DISTINCT FROM auth.uid()
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized to read net worth for this user';
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
  INTO v_cashflow
  FROM public.transactions
  WHERE user_id = p_user_id
    AND date <= p_date
    AND deleted_at IS NULL;

  v_cashflow := COALESCE(v_cashflow, 0);

  FOR v_asset IN
    SELECT type, quantity, purchase_price, current_price, id
    FROM public.portfolio_assets
    WHERE user_id = p_user_id
      AND type IN ('stock','etf','crypto','bond','real_estate')
      AND (sold_at IS NULL OR sold_at > p_date)
  LOOP
    SELECT price INTO v_hist_price
    FROM public.asset_price_history
    WHERE asset_id = v_asset.id
      AND recorded_at <= p_date
    ORDER BY recorded_at DESC
    LIMIT 1;

    IF v_hist_price IS NULL THEN
      v_hist_price := COALESCE(v_asset.current_price, v_asset.purchase_price);
    END IF;

    IF v_asset.type IN ('stock','etf','crypto','bond') THEN
      v_portfolio_pl := v_portfolio_pl + ((v_hist_price - v_asset.purchase_price) * v_asset.quantity);
    ELSIF v_asset.type = 'real_estate' THEN
      v_real_estate_value := v_real_estate_value + (v_hist_price * v_asset.quantity);
    END IF;
  END LOOP;

  v_real_estate_discounted := v_real_estate_value * 0.75;

  RETURN QUERY SELECT
    ROUND(v_cashflow + v_portfolio_pl + v_real_estate_discounted, 2),
    ROUND(v_cashflow, 2),
    ROUND(v_portfolio_pl, 2),
    ROUND(v_real_estate_discounted, 2);
END;
$$;

COMMENT ON FUNCTION public.compute_net_worth_at(UUID, DATE) IS
  'Computes net-worth components for a user as of a given date. SECURITY DEFINER. Mirrors src/lib/netWorth.ts. Restricted to self/admin (SEC-01).';


-- snapshot_net_worth_for_user: add the auth guard.
CREATE OR REPLACE FUNCTION public.snapshot_net_worth_for_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_nw DECIMAL;
  v_cashflow DECIMAL;
  v_portfolio_pl DECIMAL;
  v_real_estate_discounted DECIMAL;
BEGIN
  IF auth.uid() IS NOT NULL
     AND p_user_id IS DISTINCT FROM auth.uid()
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized to snapshot net worth for this user';
  END IF;

  SELECT * INTO v_nw, v_cashflow, v_portfolio_pl, v_real_estate_discounted
  FROM public.compute_net_worth_at(p_user_id, v_today);

  INSERT INTO public.net_worth_snapshots (user_id, date, net_worth, components)
  VALUES (
    p_user_id,
    v_today,
    v_nw,
    jsonb_build_object(
      'cashflow', v_cashflow,
      'portfolioPL', v_portfolio_pl,
      'realEstateDiscounted', v_real_estate_discounted
    )
  )
  ON CONFLICT (user_id, date) DO UPDATE
    SET net_worth = EXCLUDED.net_worth,
        components = EXCLUDED.components,
        created_at = now();
END;
$$;

COMMENT ON FUNCTION public.snapshot_net_worth_for_user(UUID) IS
  'Upserts today''s net-worth snapshot for a single user. SECURITY DEFINER. Restricted to self/admin (SEC-01). Called by snapshot_net_worth_all() cron.';


-- backfill_net_worth_for_user: add the auth guard.
CREATE OR REPLACE FUNCTION public.backfill_net_worth_for_user(
  p_user_id UUID,
  p_from DATE DEFAULT '2024-01-01'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date DATE := p_from;
  v_today DATE := CURRENT_DATE;
  v_nw DECIMAL;
  v_cashflow DECIMAL;
  v_portfolio_pl DECIMAL;
  v_real_estate_discounted DECIMAL;
BEGIN
  IF auth.uid() IS NOT NULL
     AND p_user_id IS DISTINCT FROM auth.uid()
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized to backfill net worth for this user';
  END IF;

  WHILE v_date <= v_today LOOP
    SELECT * INTO v_nw, v_cashflow, v_portfolio_pl, v_real_estate_discounted
    FROM public.compute_net_worth_at(p_user_id, v_date);

    INSERT INTO public.net_worth_snapshots (user_id, date, net_worth, components)
    VALUES (
      p_user_id,
      v_date,
      v_nw,
      jsonb_build_object(
        'cashflow', v_cashflow,
        'portfolioPL', v_portfolio_pl,
        'realEstateDiscounted', v_real_estate_discounted
      )
    )
    ON CONFLICT (user_id, date) DO UPDATE
      SET net_worth = EXCLUDED.net_worth,
          components = EXCLUDED.components;

    v_date := v_date + 1;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.backfill_net_worth_for_user(UUID, DATE) IS
  'One-shot backfill of daily net-worth snapshots for a user, from p_from to today. SECURITY DEFINER. Restricted to self/admin (SEC-01).';


-- ----------------------------------------------------------------------------
-- SEC-02: shared_expenses_view must filter on ACTIVE connections only.
-- The custom-split migration (20260703020000) recreated the view with
-- is_in_connection_any (includes revoked connections), reintroducing the S-9
-- privacy regression. Restore the active-connection filter.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.shared_expenses_view;
CREATE VIEW public.shared_expenses_view AS
SELECT
  se.id,
  se.connection_id,
  se.original_tx_id,
  se.created_by,
  se.couple_category_name,
  se.split_mode,
  se.partner_amount,
  se.split_percentage,
  se.created_at,
  se.updated_at,
  t.amount                                                                   AS total_amount,
  CASE
    WHEN se.split_mode = 'custom' THEN se.partner_amount
    ELSE ROUND(t.amount / 2.0, 2)
  END                                                                       AS partner_share_amount,
  CASE
    WHEN se.split_mode = 'custom' THEN ROUND(t.amount - se.partner_amount, 2)
    ELSE ROUND(t.amount / 2.0, 2)
  END                                                                       AS creator_share_amount,
  CASE
    WHEN se.split_mode = 'custom' THEN se.partner_amount
    ELSE ROUND(t.amount / 2.0, 2)
  END                                                                       AS my_share_amount,
  t.currency::TEXT                                                           AS currency,
  t.exchange_rate_eur,
  t.description,
  t.date,
  t.deleted_at                                                               AS tx_deleted_at
FROM public.shared_expenses se
JOIN public.transactions t ON t.id = se.original_tx_id
WHERE
  public.is_couple_expenses_enabled()
  AND public.is_in_connection(se.connection_id);

COMMENT ON VIEW public.shared_expenses_view IS
  'Safe read-only view of shared expenses. Does not expose category_id. Supports equal (50/50) and custom (partner_amount) split modes. SEC-02: access restricted to ACTIVE connections (is_in_connection).';


-- ----------------------------------------------------------------------------
-- SEC-03: is_admin() is SECURITY DEFINER and should pin its search_path.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((permissions->>'admin')::boolean, false) = true
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;


-- ----------------------------------------------------------------------------
-- SEC-04: admin UPDATE policy on profiles must also WITH CHECK the resulting row.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ----------------------------------------------------------------------------
-- SEC-05: cap login_activity.user_agent length to prevent unbounded client input.
-- ----------------------------------------------------------------------------
ALTER TABLE public.login_activity
  DROP CONSTRAINT IF EXISTS la_user_agent_length;
ALTER TABLE public.login_activity
  ADD CONSTRAINT la_user_agent_length CHECK (user_agent IS NULL OR length(user_agent) <= 512);
