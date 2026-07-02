-- ============================================================================
-- S-9: privacy couple — nasconde i dati condivisi dopo la revoca
-- ============================================================================
-- Le policy SELECT usavano is_in_connection_any (include connessioni archiviate)
-- invece di is_in_connection (solo attive). Dopo una rottura (revoked_at) l'ex
-- partner poteva ancora leggere tutta la storia delle spese condivise e l'audit
-- log. Ora: solo connessioni attive → privacy rispettata dopo revoca.
-- ----------------------------------------------------------------------------

-- shared_expenses
DROP POLICY IF EXISTS "se_select" ON public.shared_expenses;
CREATE POLICY "se_select" ON public.shared_expenses
  FOR SELECT USING (
    public.is_couple_expenses_enabled()
    AND public.is_in_connection(connection_id)
  );

-- shared_expenses_view
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
  AND public.is_in_connection(se.connection_id);

GRANT SELECT ON public.shared_expenses_view TO authenticated;

-- couple_audit_log
DROP POLICY IF EXISTS "cal_select" ON public.couple_audit_log;
CREATE POLICY "cal_select" ON public.couple_audit_log
  FOR SELECT USING (
    public.is_couple_expenses_enabled()
    AND public.is_in_connection(connection_id)
  );

-- couple_budgets
DROP POLICY IF EXISTS "cb_select" ON public.couple_budgets;
CREATE POLICY "cb_select" ON public.couple_budgets
  FOR SELECT USING (
    public.is_couple_expenses_enabled()
    AND public.is_in_connection(connection_id)
  );

-- ============================================================================
-- S-10: restringe i log cron price_update_logs a solo admin
-- ============================================================================
-- Il ramo user_id IS NULL era leggibile da qualsiasi utente autenticato
-- (inclusi eventuali errori nel JSONB errors). Ora: solo admin.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own and cron price update logs" ON public.price_update_logs;
CREATE POLICY "Users can view own and cron price update logs" ON public.price_update_logs
  FOR SELECT
  USING (user_id = auth.uid() OR (user_id IS NULL AND public.is_admin()));

-- ============================================================================
-- S-12: aggiunge SET search_path = public alle trigger function
-- ============================================================================
-- Uniformità con la convenzione del progetto (le funzioni SECURITY DEFINER
-- già lo hanno). Rischio nullo oggi (toccano solo NEW.updated_at), ma la
-- convenzione va rispettata per coerenza e difesa futura.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at_se()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
