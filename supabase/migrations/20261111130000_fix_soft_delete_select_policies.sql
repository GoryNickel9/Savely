-- ============================================================================
-- FIX SOFT DELETE BLOCCATA DALLE POLICY SELECT (recurring_expenses, transactions)
-- ============================================================================
-- Sintomo: PATCH .../recurring_expenses (soft delete: deleted_at = now())
-- risponde 403 "new row violates row-level security policy".
--
-- Causa: la policy SELECT conteneva `AND deleted_at IS NULL`. In PostgreSQL
-- un UPDATE richiede che la riga NUOVA resti visibile anche alle policy
-- SELECT: impostare deleted_at rende la riga invisibile e l'update viene
-- rifiutato con 42501 -> HTTP 403. Riprodotto con tabella di probe.
--
-- Fix: le policy SELECT tornano alla sola proprietà (auth.uid() = user_id),
-- come già fatto per categories. Il filtro delle righe eliminate resta a
-- carico delle query client (.is('deleted_at', null)); RLS continua a
-- limitare la lettura al solo proprietario.

DROP POLICY IF EXISTS "Users can view their own recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users can view their own recurring expenses" ON public.recurring_expenses
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
CREATE POLICY "Users can view their own transactions" ON public.transactions
  FOR SELECT
  USING (auth.uid() = user_id);
