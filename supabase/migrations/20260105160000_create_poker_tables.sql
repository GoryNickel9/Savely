-- Tabella per i costi mensili del poker
CREATE TABLE IF NOT EXISTS public.poker_monthly_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  is_mandatory BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella per i record di Next Cut
CREATE TABLE IF NOT EXISTS public.poker_next_cut (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  deal DECIMAL(5, 2) NOT NULL DEFAULT 0.55,
  profit_loss DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_poker_monthly_expenses_user_id ON public.poker_monthly_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_poker_next_cut_user_id ON public.poker_next_cut(user_id);

-- Abilita RLS
ALTER TABLE public.poker_monthly_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poker_next_cut ENABLE ROW LEVEL SECURITY;

-- Politiche RLS per poker_monthly_expenses
CREATE POLICY "Users can view own monthly expenses"
ON public.poker_monthly_expenses
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monthly expenses"
ON public.poker_monthly_expenses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monthly expenses"
ON public.poker_monthly_expenses
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own monthly expenses"
ON public.poker_monthly_expenses
FOR DELETE
USING (auth.uid() = user_id);

-- Politiche RLS per poker_next_cut
CREATE POLICY "Users can view own next cut"
ON public.poker_next_cut
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own next cut"
ON public.poker_next_cut
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own next cut"
ON public.poker_next_cut
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own next cut"
ON public.poker_next_cut
FOR DELETE
USING (auth.uid() = user_id);