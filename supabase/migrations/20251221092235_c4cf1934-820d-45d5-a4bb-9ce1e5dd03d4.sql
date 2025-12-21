-- Create a table for ISIN to ticker/asset mappings
CREATE TABLE public.isin_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  isin TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'etf',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.isin_mappings ENABLE ROW LEVEL SECURITY;

-- Create unique constraint for user_id + isin combination
CREATE UNIQUE INDEX idx_isin_mappings_user_isin ON public.isin_mappings(user_id, isin);

-- Create policies for user access
CREATE POLICY "Users can view their own ISIN mappings" 
ON public.isin_mappings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own ISIN mappings" 
ON public.isin_mappings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ISIN mappings" 
ON public.isin_mappings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ISIN mappings" 
ON public.isin_mappings 
FOR DELETE 
USING (auth.uid() = user_id);