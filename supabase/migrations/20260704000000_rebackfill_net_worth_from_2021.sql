-- ============================================================================
-- Re-backfill dei net-worth snapshot partendo dal 2021-01-01.
--
-- Il backfill originale (20260703060000) partiva dal 2024-01-01 hard-coded,
-- ma nel progetto ci sono transazioni dal 2023-06-01 e asset dal 2021-01-08.
-- Questo riavvia il backfill dal 2021-01-01 per tutti gli utenti, così lo
-- storico copre davvero l'intero periodo disponibile.
--
-- Le date >= 2024-01-01 vengono ricalcolate con gli stessi valori (ON CONFLICT
-- DO UPDATE) quindi nessuna perdita; le date 2021-2023 vengono aggiunte.
-- Onere: ~2000 giorni * utenti * asset. Una tantum.
-- ============================================================================

DO $$
DECLARE
  v_uid UUID;
BEGIN
  FOR v_uid IN SELECT user_id FROM public.profiles LOOP
    BEGIN
      PERFORM public.backfill_net_worth_for_user(v_uid, '2021-01-01');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Re-backfill fallito per user %: %', v_uid, SQLERRM;
    END;
  END LOOP;
END;
$$;
