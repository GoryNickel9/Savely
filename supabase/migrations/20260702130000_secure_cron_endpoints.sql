-- ============================================================================
-- S-3: Rende sicuri gli endpoint edge function "cron"
-- ============================================================================
-- Le funzioni update-prices / update-tcg-prices / process-recurring-expenses
-- erano richiamabili anonimamente (verify_jwt=false + nessun check nel corpo):
-- il codice PRESUMEVA che fossero "internal-only", ma sono HTTP pubblici.
-- Ora ognuna richiede un header x-cron-secret la cui valore è letto da questa
-- tabella (sorgente unica). Il secret viene confrontato lato edge function.
--
-- Tabella cron_config: RLS abilitata, NESSUNA policy -> inaccessibile ai
-- client anon/authenticated. Solo il service role / postgres (pg_cron gira
-- come postgres) può leggerla. Le edge function la leggono via client
-- service-role. In questo modo il secret è salvato in UN solo posto.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cron_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE public.cron_config ENABLE ROW LEVEL SECURITY;

-- Valore placeholder: l'OPERATORE deve aggiornarlo a un secret robusto, es:
--   UPDATE cron_config SET value = '<secret casuale>' WHERE key = 'cron_secret';
-- Lo stesso valore NON va messo altrove: le edge function lo leggono da qui.
INSERT INTO public.cron_config (key, value)
VALUES ('cron_secret', 'CHANGE_ME_GENERATE_A_RANDOM_SECRET')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.cron_config IS
  'Configurazione riservata per i job cron (RLS deny-all; solo postgres/service role). Imposta cron_secret a un valore random prima di abilitare i job.';

-- ----------------------------------------------------------------------------
-- Rischedula i 3 job cron passando l'header x-cron-secret letto da cron_config.
-- (pg_cron gira come postgres -> bypassa RLS -> può leggere la tabella.)
-- ----------------------------------------------------------------------------

-- update-prices-daily (1:00 UTC)
SELECT cron.unschedule('update-prices-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'update-prices-daily');

SELECT cron.schedule(
  'update-prices-daily',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://crqnfbahytzenisospcx.supabase.co/functions/v1/update-prices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.cron_config WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- update-tcg-prices-weekly (lunedì 1:01 UTC)
SELECT cron.unschedule('update-tcg-prices-weekly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'update-tcg-prices-weekly');

SELECT cron.schedule(
  'update-tcg-prices-weekly',
  '1 1 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://crqnfbahytzenisospcx.supabase.co/functions/v1/update-tcg-prices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.cron_config WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- process-recurring-expenses-daily (1:02 UTC)
SELECT cron.unschedule('process-recurring-expenses-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-recurring-expenses-daily');

SELECT cron.schedule(
  'process-recurring-expenses-daily',
  '2 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://crqnfbahytzenisospcx.supabase.co/functions/v1/process-recurring-expenses',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM public.cron_config WHERE key = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
