-- ============================================================================
-- AGGIUNTA CAMPO DELETED_AT PER IMPLEMENTARE SOFT DELETE
-- ============================================================================

-- Aggiunge campo deleted_at alla tabella transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Aggiunge campo deleted_at alla tabella categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Aggiunge campo deleted_at alla tabella recurring_expenses
ALTER TABLE public.recurring_expenses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- ============================================================================
-- INDICI PER PERFORMANCE SU DELETED_AT
-- ============================================================================

-- Indice per transactions
CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at ON public.transactions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_transactions_user_deleted ON public.transactions(user_id, deleted_at);

-- Indice per categories
CREATE INDEX IF NOT EXISTS idx_categories_deleted_at ON public.categories(deleted_at);
CREATE INDEX IF NOT EXISTS idx_categories_user_deleted ON public.categories(user_id, deleted_at);

-- Indice per recurring_expenses
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_deleted_at ON public.recurring_expenses(deleted_at);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_user_deleted ON public.recurring_expenses(user_id, deleted_at);

-- ============================================================================
-- AGGIORNAMENTO POLICY RLS PER ESCLUDERE RECORD ELIMINATI
-- ============================================================================

-- Aggiorna policy per transactions (SELECT)
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
CREATE POLICY "Users can view their own transactions" ON public.transactions 
FOR SELECT 
USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Aggiorna policy per categories (SELECT)
DROP POLICY IF EXISTS "Users can view their own categories" ON public.categories;
CREATE POLICY "Users can view their own categories" ON public.categories 
FOR SELECT 
USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Aggiorna policy per recurring_expenses (SELECT)
DROP POLICY IF EXISTS "Users can view their own recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users can view their own recurring expenses" ON public.recurring_expenses 
FOR SELECT 
USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Nota: Le policy per INSERT, UPDATE e DELETE rimangono invariate
-- perché gli utenti possono ancora creare, modificare ed eliminare record
-- L'eliminazione fisica è ancora permessa, ma il sistema di sincronizzazione
-- userà soft delete impostando deleted_at invece di eliminare fisicamente
