-- Create recurring frequency enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recurring_frequency') THEN
    CREATE TYPE public.recurring_frequency AS ENUM ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly');
  END IF;
END $$;

-- Create recurring_expenses table
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  currency currency_code DEFAULT 'EUR',
  frequency recurring_frequency NOT NULL,
  next_due_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'recurring_expenses' AND rowsecurity = true) THEN
    ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- RLS Policies for recurring_expenses
DROP POLICY IF EXISTS "Users can view their own recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users can view their own recurring expenses" ON public.recurring_expenses FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create their own recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users can create their own recurring expenses" ON public.recurring_expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users can update their own recurring expenses" ON public.recurring_expenses FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users can delete their own recurring expenses" ON public.recurring_expenses FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_recurring_expenses_updated_at ON public.recurring_expenses;
CREATE TRIGGER update_recurring_expenses_updated_at BEFORE UPDATE ON public.recurring_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_user_date ON public.recurring_expenses(user_id, next_due_date);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active ON public.recurring_expenses(user_id, is_active);