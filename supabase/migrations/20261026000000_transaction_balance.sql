-- Saldi completi in una sola riga, senza dipendere dal limite REST sui movimenti.
CREATE OR REPLACE FUNCTION public.get_transaction_balance(p_date DATE, p_previous_date DATE)
RETURNS TABLE(balance NUMERIC, previous_balance NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF p_date IS NULL OR p_previous_date IS NULL THEN
    RAISE EXCEPTION 'Balance dates must not be null' USING ERRCODE = '22004';
  END IF;

  RETURN QUERY
  SELECT
    ROUND(COALESCE(SUM(
      CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END
      * t.exchange_rate_eur
    ) FILTER (WHERE t.date <= p_date), 0), 2),
    ROUND(COALESCE(SUM(
      CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END
      * t.exchange_rate_eur
    ) FILTER (WHERE t.date <= p_previous_date), 0), 2)
  FROM public.transactions t
  WHERE t.user_id = (SELECT auth.uid())
    AND t.deleted_at IS NULL
    AND t.date <= GREATEST(p_date, p_previous_date);
END;
$$;

REVOKE ALL ON FUNCTION public.get_transaction_balance(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_transaction_balance(DATE, DATE) TO authenticated;
COMMENT ON FUNCTION public.get_transaction_balance(DATE, DATE) IS
  'EUR cashflow through both inclusive dates for auth.uid(); respects RLS and excludes soft-deleted transactions.';

NOTIFY pgrst, 'reload schema';
