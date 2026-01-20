-- ============================================================================
-- FIX POLICY UPDATE PER TRANSACTIONS PER PERMETTERE AGGIORNAMENTO DELETED_AT
-- ============================================================================

-- Aggiorna policy per transactions (UPDATE) per permettere l'aggiornamento di tutti i campi incluso deleted_at
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
CREATE POLICY "Users can update their own transactions" ON public.transactions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Nota: La politica WITH CHECK (auth.uid() = user_id) permette l'aggiornamento
-- di tutti i campi purché l'utente sia il proprietario della transazione
