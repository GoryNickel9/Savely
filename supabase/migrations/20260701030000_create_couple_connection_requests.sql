-- Create couple_connection_requests table.
-- Allows users to send pairing requests to each other via couple_code.

-- ============================================================
-- Table
-- ============================================================
CREATE TABLE public.couple_connection_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT couple_connection_requests_no_self CHECK (sender_id <> receiver_id),
  CONSTRAINT couple_connection_requests_pair_key UNIQUE (sender_id, receiver_id)
);

CREATE INDEX idx_ccr_sender   ON public.couple_connection_requests (sender_id);
CREATE INDEX idx_ccr_receiver ON public.couple_connection_requests (receiver_id);
CREATE INDEX idx_ccr_status   ON public.couple_connection_requests (status);

COMMENT ON TABLE public.couple_connection_requests IS
  'Pairing requests between users with couple_expenses enabled.';

-- ============================================================
-- updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at_ccr()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_ccr_updated_at
  BEFORE UPDATE ON public.couple_connection_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_ccr();

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.couple_connection_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: sender OR receiver sees their own requests
CREATE POLICY "ccr_select_own" ON public.couple_connection_requests
  FOR SELECT USING (
    public.is_couple_expenses_enabled()
    AND (sender_id = auth.uid() OR receiver_id = auth.uid())
  );

-- INSERT: caller must be sender; couple_expenses enabled; rate-limit 10/24 h;
--         no existing active connection; UNIQUE constraint blocks duplicate pairs.
CREATE POLICY "ccr_insert" ON public.couple_connection_requests
  FOR INSERT WITH CHECK (
    public.is_couple_expenses_enabled()
    AND sender_id = auth.uid()
    -- rate-limit: max 10 requests sent in the last 24 hours
    AND (
      SELECT COUNT(*)
      FROM public.couple_connection_requests existing
      WHERE existing.sender_id = auth.uid()
        AND existing.created_at > now() - INTERVAL '24 hours'
    ) < 10
    -- no active connection already exists for the sender
    AND NOT EXISTS (
      SELECT 1 FROM public.couple_connections cc
      WHERE (cc.user_a = auth.uid() OR cc.user_b = auth.uid())
        AND cc.revoked_at IS NULL
    )
  );

-- UPDATE: sender can cancel a pending request they sent
CREATE POLICY "ccr_update_sender_cancel" ON public.couple_connection_requests
  FOR UPDATE USING (
    public.is_couple_expenses_enabled()
    AND sender_id = auth.uid()
    AND status = 'pending'
  ) WITH CHECK (status = 'cancelled');

-- UPDATE: receiver can reject a pending request
CREATE POLICY "ccr_update_receiver_reject" ON public.couple_connection_requests
  FOR UPDATE USING (
    public.is_couple_expenses_enabled()
    AND receiver_id = auth.uid()
    AND status = 'pending'
  ) WITH CHECK (status = 'rejected');

-- Note: accept is done exclusively via accept_couple_request() RPC (SECURITY DEFINER),
-- which handles the status update + connection creation atomically.
