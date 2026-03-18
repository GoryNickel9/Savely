-- ============================================================================
-- FIX POLICY UPDATE PER TRANSACTIONS PER PERMETTERE AGGIORNAMENTO CATEGORY_ID
-- ============================================================================

-- Aggiorna policy per transactions (UPDATE) per permettere l'aggiornamento di tutti i campi
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
CREATE POLICY "Users can update their own transactions" ON public.transactions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
