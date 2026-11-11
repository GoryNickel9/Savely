-- ============================================================================
-- FIX POLICY UPDATE PER recurring_expenses: LA SOFT DELETE RITORNA 403
-- ============================================================================
-- Sintomo: PATCH /rest/v1/recurring_expenses?id=eq.<id>&user_id=eq.<uid>
-- risponde 403 Forbidden quando il client imposta deleted_at (soft delete),
-- mentre gli UPDATE normali (is_active, importo) passano.
-- Con policy corrette (USING/WITH CHECK = auth.uid() = user_id) un UPDATE
-- di soli deleted_at/updated_at non può violare alcun check: la policy sul
-- database remoto è quindi in drift rispetto a questa repository (percorso
-- già visto con transactions in 20260120000000).
--
-- Fix: rimuove TUTTE le policy UPDATE sulla tabella (qualunque nome, per
-- coprire anche policy rinominate o aggiunte fuori da migration) e ricrea
-- quella canonica. I RAISE NOTICE mostrano cosa viene rimosso.

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recurring_expenses'
      AND cmd = 'UPDATE'
  LOOP
    RAISE NOTICE 'Dropping UPDATE policy on recurring_expenses: %', pol.policyname;
    EXECUTE format('DROP POLICY %I ON public.recurring_expenses', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can update their own recurring expenses" ON public.recurring_expenses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
