-- Create couple_audit_log table.
-- Immutable append-only audit trail for all couple operations.

CREATE TABLE public.couple_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES public.couple_connections(id) ON DELETE SET NULL,
  actor_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,
  target_id     UUID,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cal_connection ON public.couple_audit_log (connection_id);
CREATE INDEX idx_cal_actor      ON public.couple_audit_log (actor_id);
CREATE INDEX idx_cal_created_at ON public.couple_audit_log (created_at DESC);

COMMENT ON TABLE public.couple_audit_log IS
  'Immutable audit trail for couple operations. Rows are never updated or deleted.';

-- ============================================================
-- Row Level Security — immutable from client perspective
-- ============================================================
ALTER TABLE public.couple_audit_log ENABLE ROW LEVEL SECURITY;

-- SELECT: member of connection (active or archived)
CREATE POLICY "cal_select" ON public.couple_audit_log
  FOR SELECT USING (
    public.is_couple_expenses_enabled()
    AND public.is_in_connection_any(connection_id)
  );

-- INSERT: blocked for direct client calls; only via SECURITY DEFINER RPCs/triggers
CREATE POLICY "cal_insert_blocked" ON public.couple_audit_log
  FOR INSERT WITH CHECK (false);

-- No UPDATE or DELETE policies — rows are immutable

-- ============================================================
-- Helper function to write audit entries (SECURITY DEFINER)
-- Used by RPCs and triggers that run as different roles.
-- ============================================================
CREATE OR REPLACE FUNCTION public.write_couple_audit_log(
  p_connection_id UUID,
  p_action        TEXT,
  p_target_id     UUID     DEFAULT NULL,
  p_metadata      JSONB    DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.couple_audit_log
    (connection_id, actor_id, action, target_id, metadata)
  VALUES
    (p_connection_id, auth.uid(), p_action, p_target_id, COALESCE(p_metadata, '{}'::jsonb));
EXCEPTION
  WHEN OTHERS THEN
    -- Audit failures must not break the calling operation
    NULL;
END;
$$;

COMMENT ON FUNCTION public.write_couple_audit_log(UUID, TEXT, UUID, JSONB) IS
  'Appends an entry to couple_audit_log. Silently swallows errors so audit failures do not block operations. SECURITY DEFINER.';
