-- Add net_won_ev field to poker_hourly_earnings table
ALTER TABLE public.poker_hourly_earnings
ADD COLUMN IF NOT EXISTS net_won_ev DECIMAL(10, 2) DEFAULT 0;

-- Add hourly_rate_ev field to poker_hourly_earnings table
ALTER TABLE public.poker_hourly_earnings
ADD COLUMN IF NOT EXISTS hourly_rate_ev DECIMAL(10, 2) DEFAULT 0;