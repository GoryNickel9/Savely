-- Eseguire dopo la migrazione, oppure dopo il suo contenuto nello stesso batch.
-- Tutti i dati di prova vengono annullati: non usare COMMIT in questo file.
BEGIN;

-- Visibile soltanto a questa transazione e annullato dal ROLLBACK finale.
UPDATE public.app_config SET value = 'true' WHERE key = 'registrations_enabled';

INSERT INTO auth.users (id, email)
VALUES
  ('00000000-0000-4000-8000-00000000ba10', 'balance-test-1@example.invalid'),
  ('00000000-0000-4000-8000-00000000ba20', 'balance-test-2@example.invalid');

INSERT INTO public.transactions (user_id, type, amount, currency, date)
SELECT '00000000-0000-4000-8000-00000000ba10', 'income', 1, 'EUR', DATE '2026-01-01'
FROM generate_series(1, 1001);

INSERT INTO public.transactions (id, user_id, type, amount, currency, exchange_rate_eur, date, deleted_at)
VALUES
  ('00000000-0000-4000-8000-00000000be10', '00000000-0000-4000-8000-00000000ba10', 'expense', 50, 'EUR', 1, '2026-10-10', NULL),
  ('00000000-0000-4000-8000-00000000bf10', '00000000-0000-4000-8000-00000000ba10', 'income', 10, 'USD', 0.5, '2026-10-10', NULL),
  ('00000000-0000-4000-8000-00000000bf20', '00000000-0000-4000-8000-00000000ba10', 'income', 600, 'EUR', 1, '2026-10-29', NULL),
  ('00000000-0000-4000-8000-00000000bd10', '00000000-0000-4000-8000-00000000ba10', 'income', 500, 'EUR', 1, '2026-10-10', now());

INSERT INTO public.transactions (user_id, type, amount, currency, date)
VALUES ('00000000-0000-4000-8000-00000000ba20', 'income', 9000, 'EUR', '2026-01-01');

SET LOCAL ROLE authenticated;
DO $claim$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000ba10', true);
END;
$claim$;

DO $test$
DECLARE
  result RECORD;
BEGIN
  IF has_function_privilege('anon', 'public.get_transaction_balance(date,date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous callers must not execute the balance RPC';
  END IF;

  SELECT * INTO result FROM public.get_transaction_balance('2026-10-26', '2026-09-30');
  IF result.balance <> 956 OR result.previous_balance <> 1001 THEN
    RAISE EXCEPTION 'Full-history, FX, cutoff, deletion or isolation failed: %', row_to_json(result);
  END IF;

  SELECT * INTO result FROM public.get_transaction_balance('2022-01-01', '2022-01-01');
  IF result.balance <> 0 OR result.previous_balance <> 0 THEN
    RAISE EXCEPTION 'Empty histories must return zero';
  END IF;

  UPDATE public.transactions SET amount = 80 WHERE id = '00000000-0000-4000-8000-00000000be10';
  SELECT * INTO result FROM public.get_transaction_balance('2026-10-26', '2026-09-30');
  IF result.balance <> 926 THEN RAISE EXCEPTION 'Retroactive amount edit was not reflected'; END IF;

  UPDATE public.transactions SET date = '2026-09-10' WHERE id = '00000000-0000-4000-8000-00000000bf10';
  SELECT * INTO result FROM public.get_transaction_balance('2026-10-26', '2026-09-30');
  IF result.balance <> 926 OR result.previous_balance <> 1006 THEN
    RAISE EXCEPTION 'Moving a transaction to another month was not reflected';
  END IF;

END;
$test$;

-- La RLS impedisce al client di impostare deleted_at: simula la manutenzione DB.
RESET ROLE;
UPDATE public.transactions SET deleted_at = now() WHERE id = '00000000-0000-4000-8000-00000000be10';
SET LOCAL ROLE authenticated;

DO $test$
DECLARE
  result RECORD;
BEGIN
  SELECT * INTO result FROM public.get_transaction_balance('2026-10-26', '2026-09-30');
  IF result.balance <> 1006 THEN RAISE EXCEPTION 'Soft deletion was not reflected'; END IF;

  DELETE FROM public.transactions WHERE id = '00000000-0000-4000-8000-00000000bf10';
  SELECT * INTO result FROM public.get_transaction_balance('2026-10-26', '2026-09-30');
  IF result.balance <> 1001 THEN RAISE EXCEPTION 'Deletion was not reflected'; END IF;

  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000ba20', true);
  SELECT * INTO result FROM public.get_transaction_balance('2026-10-26', '2026-09-30');
  IF result.balance <> 9000 OR result.previous_balance <> 9000 THEN
    RAISE EXCEPTION 'User isolation failed';
  END IF;

  BEGIN
    PERFORM public.get_transaction_balance(NULL, '2026-09-30');
    RAISE EXCEPTION 'Null date must be rejected';
  EXCEPTION WHEN null_value_not_allowed THEN
    NULL;
  END;
END;
$test$;

ROLLBACK;
SELECT 'transaction_balance tests passed; fixtures rolled back' AS status;
