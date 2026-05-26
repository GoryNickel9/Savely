-- Schedule daily cron for recurring expenses processing
-- Runs at 1:02 UTC (2:02 CET / 3:02 CEST) — after update-prices-daily (1:00) and update-tcg-prices-weekly (1:01)
SELECT cron.unschedule('process-recurring-expenses-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-recurring-expenses-daily'
);

SELECT cron.schedule(
  'process-recurring-expenses-daily',
  '2 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://crqnfbahytzenisospcx.supabase.co/functions/v1/process-recurring-expenses',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
