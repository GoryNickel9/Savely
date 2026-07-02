-- ============================================================================
-- S-3 (follow-up): genera automaticamente un secret casuale per i cron.
-- ============================================================================
-- Imposta cron_secret a un UUID v4 generato dal DB (122 bit di entropia,
-- più che sufficiente per un secret cron interno). Entrambi i lati (pg_cron
-- che passa l'header e le edge function che lo validano) leggono lo stesso
-- valore da cron_config, quindi il sistema funziona senza intervento manuale.
--
-- Idempotente: aggiorna SOLO se il valore è ancora il placeholder.
-- Nessun secret è presente nel codice: il valore esiste solo nel DB.
UPDATE public.cron_config
SET value = gen_random_uuid()::text
WHERE key = 'cron_secret'
  AND value = 'CHANGE_ME_GENERATE_A_RANDOM_SECRET';
