-- ============================================================================
-- FIX POLICY UPDATE PER TRANSACTIONS - RIMUOVIAMO WITH CHECK
-- ============================================================================

-- Aggiorna policy per transactions (UPDATE) per permettere l'aggiornamento di tutti i campi
-- Rimuoviamo WITH CHECK per evitare problemi quando si aggiorna solo deleted_at
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
CREATE POLICY "Users can update their own transactions" ON public.transactions
FOR UPDATE
USING (auth.uid() = user_id);

-- Nota: Senza WITH CHECK, la politica permette l'aggiornamento di tutti i campi
-- purché l'utente sia il proprietario della transazione (verificato tramite USING)
