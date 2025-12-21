-- Create table for price history
CREATE TABLE public.asset_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.portfolio_assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  price NUMERIC NOT NULL,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (asset_id, recorded_at) -- One price per asset per day
);

-- Enable RLS
ALTER TABLE public.asset_price_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own price history"
ON public.asset_price_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own price history"
ON public.asset_price_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own price history"
ON public.asset_price_history
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_price_history_asset_date ON public.asset_price_history(asset_id, recorded_at DESC);