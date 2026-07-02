-- ============================================================================
-- Schedule the daily net-worth snapshot cron.
-- Runs at 01:05 UTC (after update-prices at 01:00 and process-recurring at 01:02,
-- so the day's prices and recurring transactions are reflected).
-- Unlike the HTTP-triggered crons, this one calls the SQL function directly via
-- pg_cron — no edge function needed.
-- ============================================================================

SELECT cron.unschedule('snapshot-net-worth-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'snapshot-net-worth-daily');

SELECT cron.schedule(
  'snapshot-net-worth-daily',
  '5 1 * * *',
  $$ SELECT public.snapshot_net_worth_all(); $$
);
