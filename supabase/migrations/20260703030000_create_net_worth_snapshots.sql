-- ============================================================================
-- Net worth daily snapshots.
-- Stores one net-worth value per user per day, populated by the
-- snapshot_net_worth_all() function scheduled via pg_cron (see next migration)
-- and by the one-shot backfill_net_worth_for_user() function.
--
-- Rows are written ONLY by SECURITY DEFINER functions; clients can SELECT their
-- own rows but cannot INSERT/UPDATE/DELETE (insert is blocked via WITH CHECK
-- false, mirroring the couple_connections pattern).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.net_worth_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  net_worth   DECIMAL(15, 2) NOT NULL,
  -- Breakdown components for the chart (cashflow, portfolioPL, realEstateDiscounted).
  components  JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT net_worth_snapshots_user_date_unique UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_net_worth_snapshots_user_date
  ON public.net_worth_snapshots (user_id, date DESC);

ALTER TABLE public.net_worth_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can read only their own snapshots.
DROP POLICY IF EXISTS "nws_select_own" ON public.net_worth_snapshots;
CREATE POLICY "nws_select_own" ON public.net_worth_snapshots
  FOR SELECT USING (auth.uid() = user_id);

-- Clients cannot write snapshots directly — only the SECURITY DEFINER cron
-- functions populate this table. Block all client mutations.
DROP POLICY IF EXISTS "nws_insert_blocked" ON public.net_worth_snapshots;
CREATE POLICY "nws_insert_blocked" ON public.net_worth_snapshots
  FOR INSERT WITH CHECK (false);

COMMENT ON TABLE public.net_worth_snapshots IS
  'Daily net-worth snapshots per user. Populated exclusively by snapshot_net_worth_*() SECURITY DEFINER functions (cron). The net_worth formula mirrors src/lib/netWorth.ts: cashflow + portfolioPL + realEstateDiscounted(0.75).';
