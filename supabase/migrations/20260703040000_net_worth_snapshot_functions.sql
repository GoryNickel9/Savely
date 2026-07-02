-- ============================================================================
-- Net worth snapshot functions (SECURITY DEFINER, run as service role via cron).
--
-- The formula mirrors src/lib/netWorth.ts::calculateNetWorth exactly:
--   netWorth = cashflow + portfolioPL + realEstateDiscounted
-- where:
--   cashflow             = SUM(income amount) − SUM(expense amount) up to the date
--   portfolioPL          = SUM over open investment assets (stock/etf/crypto/bond)
--                          of (current_price − purchase_price) * quantity
--   realEstateDiscounted = SUM(real_estate market value) * 0.75
-- Cash and 'other' assets are excluded (already in cashflow / not financial).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: compute net worth components for a user AS OF a given date.
-- Uses asset_price_history for historical backfill (price closest to p_date),
-- falling back to purchase_price when no history is available.
-- Returns a composite: (net_worth, cashflow, portfolio_pl, real_estate_discounted).
-- ---------------------------------------------------------------------------
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
  -- Cashflow: sum income - sum expense up to (and including) p_date.
  SELECT
    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
  INTO v_cashflow
  FROM public.transactions
  WHERE user_id = p_user_id
    AND date <= p_date
    AND deleted_at IS NULL;

  v_cashflow := COALESCE(v_cashflow, 0);

  -- Iterate over open investment + real estate assets (exclude cash, other).
  -- "Open" at p_date means: not sold before p_date.
  FOR v_asset IN
    SELECT type, quantity, purchase_price, current_price, id
    FROM public.portfolio_assets
    WHERE user_id = p_user_id
      AND type IN ('stock','etf','crypto','bond','real_estate')
      AND (sold_at IS NULL OR sold_at > p_date)
  LOOP
    -- Best-known price AT p_date: use the most recent asset_price_history row
    -- on or before p_date; fall back to current_price; fall back to purchase_price.
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
  'Computes net-worth components for a user as of a given date. SECURITY DEFINER. Mirrors src/lib/netWorth.ts.';

-- ---------------------------------------------------------------------------
-- snapshot_net_worth_for_user(p_user_id): upsert today's snapshot for one user.
-- ---------------------------------------------------------------------------
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
  'Upserts today''s net-worth snapshot for a single user. SECURITY DEFINER. Called by snapshot_net_worth_all() cron.';

-- ---------------------------------------------------------------------------
-- snapshot_net_worth_all(): snapshot every user with a profile.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snapshot_net_worth_all()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  FOR v_uid IN SELECT user_id FROM public.profiles LOOP
    PERFORM public.snapshot_net_worth_for_user(v_uid);
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.snapshot_net_worth_all() IS
  'Snapshots net worth for all users. SECURITY DEFINER. Scheduled daily by pg_cron.';

-- ---------------------------------------------------------------------------
-- backfill_net_worth_for_user(p_user_id, p_from): one-shot historical backfill.
-- Loops day-by-day from p_from (default 2024-01-01) to today, computing the
-- net worth for each day using asset_price_history where available.
-- NOTE: this is O(days * assets) and can be slow for long ranges / many assets.
-- Run it once per user after deploying this feature.
-- ---------------------------------------------------------------------------
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
  'One-shot backfill of daily net-worth snapshots for a user, from p_from to today. Uses asset_price_history. SECURITY DEFINER.';
