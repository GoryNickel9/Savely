-- ============================================================================
-- Custom split for shared expenses.
-- Previously split was hard-locked to 50/50 via a CHECK constraint on
-- split_percentage. We now support two modes:
--   - 'equal'   : 50/50 (default, backward compatible)
--   - 'custom'  : partner_amount is the partner's explicit share; the creator
--                 implicitly covers (total - partner_amount).
--
-- Privacy is unchanged: couple_category_name stays free TEXT (no category_id),
-- and the view still never exposes the creator's private category.
-- ============================================================================

-- 1. Add split_mode column (defaults to 'equal' for existing rows).
ALTER TABLE public.shared_expenses
  ADD COLUMN IF NOT EXISTS split_mode TEXT NOT NULL DEFAULT 'equal'
    CHECK (split_mode IN ('equal', 'custom'));

-- 2. Add nullable partner_amount (only meaningful when split_mode = 'custom').
ALTER TABLE public.shared_expenses
  ADD COLUMN IF NOT EXISTS partner_amount DECIMAL(15, 2);

-- 3. Drop the hard 50/50 lock on split_percentage. The column is kept for
--    backward compatibility (legacy rows / clients) but new inserts should
--    use split_mode + partner_amount. Make it nullable so inserts can omit it.
ALTER TABLE public.shared_expenses
  DROP CONSTRAINT IF EXISTS shared_expenses_split_percentage_check;
ALTER TABLE public.shared_expenses
  ALTER COLUMN split_percentage DROP NOT NULL;

-- 4. Coherence constraints:
--    - custom mode MUST carry a partner_amount;
--    - partner_amount must be positive and strictly less than the transaction's
--      total (validated against the joined transaction amount below).
--    The join check is enforced via a trigger because CHECK cannot reference
--    other tables; we add a row-level guard there.
ALTER TABLE public.shared_expenses
  DROP CONSTRAINT IF EXISTS se_custom_requires_partner_amount;
ALTER TABLE public.shared_expenses
  ADD CONSTRAINT se_custom_requires_partner_amount
  CHECK (split_mode <> 'custom' OR partner_amount IS NOT NULL);

ALTER TABLE public.shared_expenses
  DROP CONSTRAINT IF EXISTS se_partner_amount_positive;
ALTER TABLE public.shared_expenses
  ADD CONSTRAINT se_partner_amount_positive
  CHECK (partner_amount IS NULL OR partner_amount > 0);

-- 5. Trigger: validate partner_amount < total_amount for custom splits,
--    and recompute the legacy split_percentage for backward-compat reads.
CREATE OR REPLACE FUNCTION public.validate_shared_expense_split()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total DECIMAL(15,2);
BEGIN
  SELECT t.amount INTO v_total
  FROM public.transactions t
  WHERE t.id = NEW.original_tx_id;

  IF v_total IS NULL THEN
    RAISE EXCEPTION 'Referenced transaction not found';
  END IF;

  IF NEW.split_mode = 'custom' THEN
    IF NEW.partner_amount IS NULL OR NEW.partner_amount <= 0 OR NEW.partner_amount >= v_total THEN
      RAISE EXCEPTION 'partner_amount must be > 0 and < the transaction total (%)', v_total;
    END IF;
    -- Backfill legacy column as the partner's percentage for read compatibility.
    NEW.split_percentage := ROUND((NEW.partner_amount / v_total) * 100.0, 2);
  ELSE
    -- equal mode: legacy column stays 50.
    NEW.split_percentage := 50.00;
    NEW.partner_amount := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_shared_expense_split ON public.shared_expenses;
CREATE TRIGGER trg_validate_shared_expense_split
  BEFORE INSERT OR UPDATE OF split_mode, partner_amount, original_tx_id
  ON public.shared_expenses
  FOR EACH ROW EXECUTE FUNCTION public.validate_shared_expense_split();

-- 6. Recreate the view to expose per-mode shares.
--    Must DROP + CREATE (CREATE OR REPLACE cannot reorder/rename columns).
--    - partner_share_amount: the partner's share (always from the viewer's
--      partner perspective it is symmetric — the amount the non-creator owes).
--    - creator_share_amount: the creator's implicit share.
--    Note: my_share_amount is kept for backward compatibility with existing
--    readers and equals the partner's share (the partner sees what the creator
--    paid on their behalf).
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
  -- Backward-compatible alias: existing consumers read "my_share_amount" as
  -- the partner's portion (what the other party owes). Kept for compatibility.
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
  AND public.is_in_connection_any(se.connection_id);

COMMENT ON VIEW public.shared_expenses_view IS
  'Safe read-only view of shared expenses. Does not expose category_id. Supports equal (50/50) and custom (partner_amount) split modes. Access filtered by couple_expenses permission and connection membership.';
