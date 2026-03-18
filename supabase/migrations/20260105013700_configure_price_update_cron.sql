-- Unschedule existing job if it exists (to allow updates)
SELECT cron.unschedule('update-prices-daily') 
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'update-prices-daily'
);

-- Schedule price update function to run daily at 2:00 UTC (3:00 CET / 4:00 CEST)
SELECT cron.schedule(
  'update-prices-daily',
  '0 2 * * *',  -- 2:00 UTC every day
  $$
  SELECT net.http_post(
    url := 'https://crqnfbahytzenisospcx.supabase.co/functions/v1/update-prices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Grant necessary permissions (these are idempotent)
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA cron TO postgres;