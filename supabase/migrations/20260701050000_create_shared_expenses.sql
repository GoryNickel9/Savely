-- Create shared_expenses table, VIEW, soft-delete trigger, and partner RPCs.

-- ============================================================
-- Table
-- ============================================================
CREATE TABLE public.shared_expenses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id       UUID NOT NULL
                      REFERENCES public.couple_connections(id) ON DELETE RESTRICT,
  original_tx_id      UUID NOT NULL
                      REFERENCES public.transactions(id) ON DELETE CASCADE,
  created_by          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  split_percentage    DECIMAL(5, 2) NOT NULL DEFAULT 50.00
                      CHECK (split_percentage = 50.00),
  couple_category_name TEXT,        -- TEXT (not FK) to preserve partner privacy
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shared_expenses_tx_unique UNIQUE (original_tx_id)
);

CREATE INDEX idx_se_connection ON public.shared_expenses (connection_id);
CREATE INDEX idx_se_created_by ON public.shared_expenses (created_by);

COMMENT ON TABLE public.shared_expenses IS
  'Records a 50/50 split of an expense transaction between two connected users.';
COMMENT ON COLUMN public.shared_expenses.couple_category_name IS
  'Category label used for couple budgeting. Stored as TEXT (not FK) to avoid exposing the creator''s private category UUIDs.';

-- ============================================================
-- updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at_se()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_se_updated_at
  BEFORE UPDATE ON public.shared_expenses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_se();

-- ============================================================
-- Soft-delete cascade: when a transaction's deleted_at is set,
-- remove the corresponding shared_expense row automatically.
-- ============================================================
CREATE OR REPLACE FUNCTION public.on_tx_soft_delete_remove_shared_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM public.shared_expenses WHERE original_tx_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tx_soft_delete_cascade_shared
  AFTER UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.on_tx_soft_delete_remove_shared_expense();

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.shared_expenses ENABLE ROW LEVEL SECURITY;

-- SELECT: member of the connection (active OR archived)
CREATE POLICY "se_select" ON public.shared_expenses
  FOR SELECT USING (
    public.is_couple_expenses_enabled()
    AND public.is_in_connection_any(connection_id)
  );

-- INSERT: caller must be creator, feature enabled, active connection,
--         transaction must belong to caller, be an expense, and not deleted.
CREATE POLICY "se_insert" ON public.shared_expenses
  FOR INSERT WITH CHECK (
    public.is_couple_expenses_enabled()
    AND public.is_in_connection(connection_id)
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = original_tx_id
        AND t.user_id  = auth.uid()
        AND t.type     = 'expense'
        AND t.deleted_at IS NULL
    )
  );

-- UPDATE: creator only, active connection
CREATE POLICY "se_update_creator" ON public.shared_expenses
  FOR UPDATE USING (
    public.is_couple_expenses_enabled()
    AND public.is_in_connection(connection_id)
    AND created_by = auth.uid()
  );

-- DELETE: creator only, active connection
CREATE POLICY "se_delete_creator" ON public.shared_expenses
  FOR DELETE USING (
    public.is_couple_expenses_enabled()
    AND public.is_in_connection(connection_id)
    AND created_by = auth.uid()
  );

-- ============================================================
-- VIEW: shared_expenses_view
-- Exposes safe columns only — category_id is intentionally excluded.
-- The WHERE clause enforces access control using helper functions so
-- that even without per-row RLS the view only returns authorised rows.
-- ============================================================
CREATE OR REPLACE VIEW public.shared_expenses_view AS
SELECT
  se.id,
  se.connection_id,
  se.original_tx_id,
  se.created_by,
  se.couple_category_name,
  se.split_percentage,
  se.created_at,
  se.updated_at,
  t.amount                              AS total_amount,
  ROUND(t.amount / 2.0, 2)             AS my_share_amount,
  t.currency::TEXT                      AS currency,
  t.exchange_rate_eur,
  t.description,
  t.date,
  t.deleted_at                          AS tx_deleted_at
FROM public.shared_expenses se
JOIN public.transactions t ON t.id = se.original_tx_id
WHERE
  public.is_couple_expenses_enabled()
  AND public.is_in_connection_any(se.connection_id);

GRANT SELECT ON public.shared_expenses_view TO authenticated;

COMMENT ON VIEW public.shared_expenses_view IS
  'Safe read-only view of shared expenses. Does not expose category_id. Access is filtered by couple_expenses permission and connection membership.';

-- ============================================================
-- RPC: update_shared_expense_by_partner
-- Partner (non-creator) may update couple_category_name only.
-- SECURITY DEFINER: bypasses RLS to allow cross-user update.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_shared_expense_by_partner(
  p_id                   UUID,
  p_couple_category_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_connection_id UUID;
  v_created_by    UUID;
BEGIN
  IF NOT public.is_couple_expenses_enabled() THEN
    RAISE EXCEPTION 'couple_expenses not enabled for the current user';
  END IF;

  SELECT connection_id, created_by
  INTO   v_connection_id, v_created_by
  FROM   public.shared_expenses
  WHERE  id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shared expense not found';
  END IF;

  IF v_created_by = auth.uid() THEN
    RAISE EXCEPTION 'Use a direct UPDATE for your own shared expenses';
  END IF;

  IF NOT public.is_in_connection(v_connection_id) THEN
    RAISE EXCEPTION 'Not a member of an active connection';
  END IF;

  UPDATE public.shared_expenses
  SET    couple_category_name = COALESCE(p_couple_category_name, couple_category_name),
         updated_at           = now()
  WHERE  id = p_id;

  -- TODO Phase 4: write shared_expense_updated to couple_audit_log
END;
$$;

COMMENT ON FUNCTION public.update_shared_expense_by_partner(UUID, TEXT) IS
  'Partner (non-creator) updates couple_category_name. SECURITY DEFINER.';

-- ============================================================
-- RPC: delete_shared_expense_by_partner
-- Partner (non-creator) removes the shared link.
-- The creator''s original transaction is preserved.
-- SECURITY DEFINER: bypasses RLS to allow cross-user delete.
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_shared_expense_by_partner(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_connection_id UUID;
  v_created_by    UUID;
BEGIN
  IF NOT public.is_couple_expenses_enabled() THEN
    RAISE EXCEPTION 'couple_expenses not enabled for the current user';
  END IF;

  SELECT connection_id, created_by
  INTO   v_connection_id, v_created_by
  FROM   public.shared_expenses
  WHERE  id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shared expense not found';
  END IF;

  IF v_created_by = auth.uid() THEN
    RAISE EXCEPTION 'Use a direct DELETE for your own shared expenses';
  END IF;

  IF NOT public.is_in_connection(v_connection_id) THEN
    RAISE EXCEPTION 'Not a member of an active connection';
  END IF;

  DELETE FROM public.shared_expenses WHERE id = p_id;

  -- TODO Phase 4: write shared_expense_deleted to couple_audit_log
END;
$$;

COMMENT ON FUNCTION public.delete_shared_expense_by_partner(UUID) IS
  'Partner (non-creator) removes the shared expense link. Creator''s transaction is preserved. SECURITY DEFINER.';
