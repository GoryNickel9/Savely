-- Add user_id to price_update_logs so each user only sees their own logs
ALTER TABLE public.price_update_logs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Anyone can view price update logs" ON public.price_update_logs;

-- Users see their own logs; service-role cron logs (user_id IS NULL) are visible to no one via client
CREATE POLICY "Users can view own price update logs"
ON public.price_update_logs
FOR SELECT
USING (user_id = auth.uid());
