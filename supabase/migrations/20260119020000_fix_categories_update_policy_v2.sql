-- ============================================================================
-- FIX POLICY UPDATE PER CATEGORIES PER PERMETTERE SOFT DELETE (VERSIONE 2)
-- ============================================================================

-- Aggiorna policy per categories (UPDATE) per permettere l'aggiornamento di tutti i campi
-- Rimuoviamo il controllo WITH CHECK per permettere l'aggiornamento di deleted_at
DROP POLICY IF EXISTS "Users can update their own categories" ON public.categories;
CREATE POLICY "Users can update their own categories" ON public.categories
FOR UPDATE
USING (auth.uid() = user_id);
