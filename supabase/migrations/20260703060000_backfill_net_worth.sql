-- ============================================================================
-- Initial backfill of net-worth snapshots for all existing users.
-- This is a one-shot migration: it runs backfill_net_worth_for_user() for each
-- user from 2024-01-01 to today. It can be slow on large accounts; it is
-- written as a DO block so it survives a partial failure per-user.
--
-- NOTE: if you have users with very long histories or many assets, consider
-- running this manually per-user during a maintenance window instead.
-- ============================================================================

DO $$
DECLARE
  v_uid UUID;
BEGIN
  FOR v_uid IN SELECT user_id FROM public.profiles LOOP
    BEGIN
      PERFORM public.backfill_net_worth_for_user(v_uid, '2024-01-01');
    EXCEPTION WHEN OTHERS THEN
      -- Log and continue: a failure for one user must not block the others.
      RAISE NOTICE 'Backfill failed for user %: %', v_uid, SQLERRM;
    END;
  END LOOP;
END;
$$;
