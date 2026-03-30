-- Fix 1: Reschedule cron without the broken Authorization header.
-- The edge function now accepts cron calls without auth (verify_jwt = false).
SELECT cron.unschedule('update-prices-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'update-prices-daily'
);

SELECT cron.schedule(
  'update-prices-daily',
  '0 1 * * *',  -- 1:00 UTC every day (2:00 CET / 3:00 CEST)
  $$
  SELECT net.http_post(
    url := 'https://crqnfbahytzenisospcx.supabase.co/functions/v1/update-prices',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

-- Fix 2: Allow all authenticated users to see cron-triggered logs (user_id IS NULL).
DROP POLICY IF EXISTS "Users can view own price update logs" ON public.price_update_logs;
DROP POLICY IF EXISTS "Users can view own and cron price update logs" ON public.price_update_logs;

CREATE POLICY "Users can view own and cron price update logs"
ON public.price_update_logs
FOR SELECT
USING (user_id = auth.uid() OR user_id IS NULL);
