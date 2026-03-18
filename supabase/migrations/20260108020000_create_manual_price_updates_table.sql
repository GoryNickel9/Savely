-- Create table to track manual price updates
CREATE TABLE IF NOT EXISTS manual_price_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assets_updated INTEGER NOT NULL DEFAULT 0,
  assets_checked INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE manual_price_updates ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their own manual updates
CREATE POLICY "Users can view own manual updates"
  ON manual_price_updates
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Users can insert their own manual updates
CREATE POLICY "Users can insert own manual updates"
  ON manual_price_updates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_manual_price_updates_user_id_updated_at 
  ON manual_price_updates(user_id, updated_at DESC);
