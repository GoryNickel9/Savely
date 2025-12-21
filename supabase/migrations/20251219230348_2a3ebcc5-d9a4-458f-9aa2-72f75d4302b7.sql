-- Create table to log price updates
CREATE TABLE public.price_update_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  assets_updated integer NOT NULL DEFAULT 0,
  assets_checked integer NOT NULL DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb
);

-- Enable RLS
ALTER TABLE public.price_update_logs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read logs (needed for UI to show last update)
CREATE POLICY "Anyone can view price update logs"
ON public.price_update_logs
FOR SELECT
USING (true);