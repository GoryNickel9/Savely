-- ============================================================================
-- S-4: aggiunge esplicitamente WITH CHECK alle policy FOR UPDATE mancanti
-- ============================================================================
-- Le policy UPDATE usavano solo USING (auth.uid() = user_id) senza WITH CHECK.
-- PostgreSQL di default riusa la USING come WITH CHECK, quindi l'exploit
-- diretto (riassegnare user_id a un altro utente) è probabilmente già bloccato;
-- TUTTAVIA i commenti delle migration precedenti rivelavano la concezione
-- errata "senza WITH CHECK si possono aggiornare tutti i campi". Rendere il
-- check esplicito:
--   1) rimuove ogni ambiguità sul comportamento;
--   2) corregge la documentazione/intento;
--   3) protegge da regressioni se in futuro si aggiungono policy combinate.
-- La condizione è identica alla USING esistente: nessun impatto funzionale.
-- ----------------------------------------------------------------------------

-- transactions
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
CREATE POLICY "Users can update their own transactions" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- categories
DROP POLICY IF EXISTS "Users can update their own categories" ON public.categories;
CREATE POLICY "Users can update their own categories" ON public.categories
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- recurring_expenses
DROP POLICY IF EXISTS "Users can update their own recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users can update their own recurring expenses" ON public.recurring_expenses
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- category_mappings
DROP POLICY IF EXISTS "Users can update their own category mappings" ON public.category_mappings;
CREATE POLICY "Users can update their own category mappings" ON public.category_mappings
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- isin_mappings
DROP POLICY IF EXISTS "Users can update their own ISIN mappings" ON public.isin_mappings;
CREATE POLICY "Users can update their own ISIN mappings" ON public.isin_mappings
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- shared_expenses: la policy UPDATE del creator mancava di WITH CHECK.
-- Qui la riassegnazione cross-user è la più sensibile (feature couple).
-- La WITH CHECK replica la USING (creator attivo nella connessione).
DROP POLICY IF EXISTS "se_update_creator" ON public.shared_expenses;
CREATE POLICY "se_update_creator" ON public.shared_expenses
  FOR UPDATE USING (
    public.is_couple_expenses_enabled()
    AND public.is_in_connection(connection_id)
    AND created_by = auth.uid()
  )
  WITH CHECK (
    public.is_couple_expenses_enabled()
    AND public.is_in_connection(connection_id)
    AND created_by = auth.uid()
  );
