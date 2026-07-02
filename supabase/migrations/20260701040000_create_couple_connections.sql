-- Create couple_connections table and the accept_couple_request() RPC.

-- ============================================================
-- Table
-- ============================================================
CREATE TABLE public.couple_connections (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active connection per user (partial unique indexes allow re-connecting
-- after a connection has been revoked).
CREATE UNIQUE INDEX couple_connections_user_a_active
  ON public.couple_connections (user_a)
  WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX couple_connections_user_b_active
  ON public.couple_connections (user_b)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE public.couple_connections IS
  'Active (or historically revoked) 1-to-1 couple connections.';

-- ============================================================
-- updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at_cc()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_cc_updated_at
  BEFORE UPDATE ON public.couple_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_cc();

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE public.couple_connections ENABLE ROW LEVEL SECURITY;

-- SELECT: only members of the connection (active OR archived)
CREATE POLICY "cc_select_members" ON public.couple_connections
  FOR SELECT USING (
    public.is_couple_expenses_enabled()
    AND (user_a = auth.uid() OR user_b = auth.uid())
  );

-- INSERT: blocked for direct client calls; only the accept_couple_request() RPC
--         (SECURITY DEFINER) may insert.
CREATE POLICY "cc_insert_blocked" ON public.couple_connections
  FOR INSERT WITH CHECK (false);

-- UPDATE: a member of an active connection may only set revoked_at (soft-revoke).
CREATE POLICY "cc_update_revoke" ON public.couple_connections
  FOR UPDATE USING (
    public.is_couple_expenses_enabled()
    AND (user_a = auth.uid() OR user_b = auth.uid())
    AND revoked_at IS NULL
  ) WITH CHECK (
    revoked_at IS NOT NULL
  );

-- ============================================================
-- RPC: accept_couple_request (atomic, SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_couple_request(p_request_id UUID)
RETURNS UUID   -- returns the new connection id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id    UUID;
  v_connection_id UUID;
BEGIN
  -- Caller must have the feature enabled
  IF NOT public.is_couple_expenses_enabled() THEN
    RAISE EXCEPTION 'couple_expenses not enabled for the current user';
  END IF;

  -- Lock and verify the request atomically
  SELECT sender_id
  INTO   v_sender_id
  FROM   public.couple_connection_requests
  WHERE  id         = p_request_id
    AND  status     = 'pending'
    AND  receiver_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found, not pending, or not addressed to the current user';
  END IF;

  -- No active connection for sender
  IF EXISTS (
    SELECT 1 FROM public.couple_connections
    WHERE (user_a = v_sender_id OR user_b = v_sender_id)
      AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Sender already has an active connection';
  END IF;

  -- No active connection for receiver (current user)
  IF EXISTS (
    SELECT 1 FROM public.couple_connections
    WHERE (user_a = auth.uid() OR user_b = auth.uid())
      AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Receiver already has an active connection';
  END IF;

  -- Mark request as accepted
  UPDATE public.couple_connection_requests
  SET    status     = 'accepted',
         updated_at = now()
  WHERE  id = p_request_id;

  -- Create the connection
  INSERT INTO public.couple_connections (user_a, user_b)
  VALUES (v_sender_id, auth.uid())
  RETURNING id INTO v_connection_id;

  -- TODO Phase 4: write request_accepted to couple_audit_log

  RETURN v_connection_id;
END;
$$;

COMMENT ON FUNCTION public.accept_couple_request(UUID) IS
  'Atomically accepts a pending couple connection request and creates a connection row. SECURITY DEFINER.';
