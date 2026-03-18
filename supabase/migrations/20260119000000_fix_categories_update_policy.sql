-- ============================================================================
-- FIX POLICY UPDATE PER CATEGORIES PER PERMETTERE SOFT DELETE
-- ============================================================================

-- Aggiorna policy per categories (UPDATE) per permettere l'aggiornamento di tutti i campi
DROP POLICY IF EXISTS "Users can update their own categories" ON public.categories;
CREATE POLICY "Users can update their own categories" ON public.categories
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
