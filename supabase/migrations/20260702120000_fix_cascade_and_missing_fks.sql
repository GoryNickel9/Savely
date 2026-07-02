-- ============================================================================
-- S-1 + S-2: Corregge l'integrità del flusso di eliminazione account (GDPR)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- S-1: shared_expenses.connection_id ON DELETE RESTRICT -> CASCADE
-- Il RESTRICT impediva l'eliminazione dell'account quando il partner aveva
-- condiviso spese sulla connessione (rollback dell'intera deleteUser).
-- Il CASCADE qui è corretto: eliminando la connessione si rimuove solo il
-- "link" di condivisione; la transazione originale del partner resta (ha la
-- propria FK created_by ON DELETE CASCADE su auth.users).
-- ----------------------------------------------------------------------------
ALTER TABLE public.shared_expenses
  DROP CONSTRAINT IF EXISTS shared_expenses_connection_id_fkey;

ALTER TABLE public.shared_expenses
  ADD CONSTRAINT shared_expenses_connection_id_fkey
  FOREIGN KEY (connection_id) REFERENCES public.couple_connections(id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- S-2: Tre tabelle (recurring_expenses, category_mappings, isin_mappings)
-- erano state create SENZA FK a auth.users. La migration successiva
-- (20260105005100) tentava di aggiungerla ma usava CREATE TABLE IF NOT EXISTS,
-- che è un no-op su tabella esistente -> FK silenziosamente saltata.
-- Consequence: auth.admin.deleteUser() non propaga a queste tabelle -> dati
-- orfani (GDPR) + cron recurring che continua a processare righe orfane.
-- ----------------------------------------------------------------------------

-- 1) Pulisci eventuali righe orfane PRIMA di aggiungere il vincolo
--    (altrimenti l'ALTER fallirebbe). Sicuro: righe orfane appartengono a
--    utenti già eliminati (non recuperabili).
DELETE FROM public.recurring_expenses re
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = re.user_id);

DELETE FROM public.category_mappings cm
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = cm.user_id);

DELETE FROM public.isin_mappings im
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = im.user_id);

-- 2) Aggiungi le FK con ON DELETE CASCADE (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'recurring_expenses_user_id_fkey'
      AND table_name = 'recurring_expenses'
  ) THEN
    ALTER TABLE public.recurring_expenses
      ADD CONSTRAINT recurring_expenses_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'category_mappings_user_id_fkey'
      AND table_name = 'category_mappings'
  ) THEN
    ALTER TABLE public.category_mappings
      ADD CONSTRAINT category_mappings_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'isin_mappings_user_id_fkey'
      AND table_name = 'isin_mappings'
  ) THEN
    ALTER TABLE public.isin_mappings
      ADD CONSTRAINT isin_mappings_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
