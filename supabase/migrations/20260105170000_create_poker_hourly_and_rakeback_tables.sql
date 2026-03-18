-- Create poker_hourly_earnings table
CREATE TABLE IF NOT EXISTS public.poker_hourly_earnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours_played DECIMAL(10, 2) NOT NULL,
  profit_loss DECIMAL(10, 2) NOT NULL DEFAULT 0,
  hourly_rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create poker_rakeback table
CREATE TABLE IF NOT EXISTS public.poker_rakeback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  rake_generated DECIMAL(10, 2) NOT NULL DEFAULT 0,
  rakeback_received DECIMAL(10, 2) NOT NULL DEFAULT 0,
  rakeback_percentage DECIMAL(5, 2) NOT NULL DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.poker_hourly_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poker_rakeback ENABLE ROW LEVEL SECURITY;

-- Create policies for poker_hourly_earnings
CREATE POLICY "Users can view their own hourly earnings"
  ON public.poker_hourly_earnings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own hourly earnings"
  ON public.poker_hourly_earnings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own hourly earnings"
  ON public.poker_hourly_earnings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own hourly earnings"
  ON public.poker_hourly_earnings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create policies for poker_rakeback
CREATE POLICY "Users can view their own rakeback entries"
  ON public.poker_rakeback
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rakeback entries"
  ON public.poker_rakeback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rakeback entries"
  ON public.poker_rakeback
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rakeback entries"
  ON public.poker_rakeback
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_poker_hourly_earnings_user_id ON public.poker_hourly_earnings(user_id);
CREATE INDEX IF NOT EXISTS idx_poker_hourly_earnings_date ON public.poker_hourly_earnings(date);
CREATE INDEX IF NOT EXISTS idx_poker_rakeback_user_id ON public.poker_rakeback(user_id);
CREATE INDEX IF NOT EXISTS idx_poker_rakeback_date ON public.poker_rakeback(date);