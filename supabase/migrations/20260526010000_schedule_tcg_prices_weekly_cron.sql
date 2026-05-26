-- Schedule weekly cron for TCG card price updates (CardTrader)
-- Runs every Monday at 1:01 UTC (2:01 CET / 3:01 CEST)
SELECT cron.unschedule('update-tcg-prices-weekly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'update-tcg-prices-weekly'
);

SELECT cron.schedule(
  'update-tcg-prices-weekly',
  '1 1 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://crqnfbahytzenisospcx.supabase.co/functions/v1/update-tcg-prices',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
