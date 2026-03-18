-- Create poker_manual_expenses table
CREATE TABLE IF NOT EXISTS public.poker_manual_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.poker_manual_expenses ENABLE ROW LEVEL SECURITY;

-- Create policies for poker_manual_expenses
CREATE POLICY "Users can view their own manual expenses"
  ON public.poker_manual_expenses
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own manual expenses"
  ON public.poker_manual_expenses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own manual expenses"
  ON public.poker_manual_expenses
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own manual expenses"
  ON public.poker_manual_expenses
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_poker_manual_expenses_user_id ON public.poker_manual_expenses(user_id);