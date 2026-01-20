-- ============================================================================
-- FIX POLITICA UPDATE PER TRANSACTIONS - VERIFICA E ASSICURA CORRETTEZZA
-- ============================================================================

-- Verifica che il campo deleted_at esista
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Rimuovi tutte le politiche UPDATE esistenti per transactions
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;

-- Crea una politica UPDATE che permette l'aggiornamento di tutti i campi
-- purché l'utente sia il proprietario della transazione
CREATE POLICY "Users can update their own transactions" ON public.transactions
FOR UPDATE
USING (auth.uid() = user_id);

-- Nota: Senza WITH CHECK, la politica permette l'aggiornamento di tutti i campi
-- purché l'utente sia il proprietario della transazione (verificato tramite USING)
-- Questo permette l'aggiornamento del campo deleted_at senza problemi
