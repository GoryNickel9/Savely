-- Script per verificare e abilitare RLS su tutte le tabelle
-- Esegui in Supabase SQL Editor

-- 1. Verifica stato attuale RLS
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  forcerlspolicy
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Abilita RLS su tutte le tabelle se non è già abilitato
DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' AND rowsecurity = false
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_record.tablename);
        RAISE NOTICE 'RLS abilitato per la tabella: %', table_record.tablename;
    END LOOP;
END $$;

-- 3. Policy RLS per tabella transactions (se esiste)
DO $$
BEGIN
    -- Controlla se la tabella esiste
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transactions') THEN
        -- Rimuovi policy esistenti se presenti
        DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
        DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
        DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
        DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
        
        -- Crea nuove policy
        CREATE POLICY "Users can view own transactions" ON public.transactions
          FOR SELECT USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can insert own transactions" ON public.transactions
          FOR INSERT WITH CHECK (auth.uid() = user_id);
        
        CREATE POLICY "Users can update own transactions" ON public.transactions
          FOR UPDATE USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can delete own transactions" ON public.transactions
          FOR DELETE USING (auth.uid() = user_id);
        
        RAISE NOTICE 'Policy RLS create per transactions';
    END IF;
END $$;

-- 4. Policy RLS per tabella portfolio_assets (se esiste)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'portfolio_assets') THEN
        -- Rimuovi policy esistenti
        DROP POLICY IF EXISTS "Users can view own assets" ON public.portfolio_assets;
        DROP POLICY IF EXISTS "Users can manage own assets" ON public.portfolio_assets;
        
        -- Crea nuove policy
        CREATE POLICY "Users can view own assets" ON public.portfolio_assets
          FOR SELECT USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can manage own assets" ON public.portfolio_assets
          FOR ALL USING (auth.uid() = user_id);
        
        RAISE NOTICE 'Policy RLS create per portfolio_assets';
    END IF;
END $$;

-- 5. Verifica finale delle policy
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;