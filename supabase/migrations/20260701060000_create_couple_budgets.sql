-- Create couple_budgets table.
-- Budget mensile condiviso calcolato sulle sole spese condivise.
-- Usa lo stesso pattern sentinel month=1, year=2000 del budget personale.

CREATE TABLE public.couple_budgets (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id        UUID NOT NULL
                       REFERENCES public.couple_connections(id) ON DELETE CASCADE,
  couple_category_name TEXT NOT NULL,
  amount               DECIMAL(15, 2) NOT NULL,
  currency             public.currency_code DEFAULT 'EUR',
  month                INTEGER NOT NULL DEFAULT 1,    -- sentinel
  year                 INTEGER NOT NULL DEFAULT 2000, -- sentinel
  created_by           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, couple_category_name, month, year)
);

CREATE INDEX idx_cb_connection ON public.couple_budgets (connection_id);

COMMENT ON TABLE public.couple_budgets IS
  'Couple shared budget targets, keyed by couple_category_name (text). Uses sentinel month=1/year=2000.';

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at_cb()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_cb_updated_at
  BEFORE UPDATE ON public.couple_budgets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_cb();

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.couple_budgets ENABLE ROW LEVEL SECURITY;

-- SELECT: member (active or archived)
CREATE POLICY "cb_select" ON public.couple_budgets
  FOR SELECT USING (
    public.is_couple_expenses_enabled()
    AND public.is_in_connection_any(connection_id)
  );

-- INSERT: member of active connection
CREATE POLICY "cb_insert" ON public.couple_budgets
  FOR INSERT WITH CHECK (
    public.is_couple_expenses_enabled()
    AND public.is_in_connection(connection_id)
    AND created_by = auth.uid()
  );

-- UPDATE: any member of active connection can update a budget
CREATE POLICY "cb_update" ON public.couple_budgets
  FOR UPDATE USING (
    public.is_couple_expenses_enabled()
    AND public.is_in_connection(connection_id)
  );

-- DELETE: any member of active connection can delete a budget
CREATE POLICY "cb_delete" ON public.couple_budgets
  FOR DELETE USING (
    public.is_couple_expenses_enabled()
    AND public.is_in_connection(connection_id)
  );
