-- Retrofit existing RPCs and add triggers to populate couple_audit_log.
-- Uses CREATE OR REPLACE so this is safe to apply after the original migrations.

-- ============================================================
-- 1. Update accept_couple_request to log request_accepted
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_couple_request(p_request_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id     UUID;
  v_connection_id UUID;
BEGIN
  IF NOT public.is_couple_expenses_enabled() THEN
    RAISE EXCEPTION 'couple_expenses not enabled for the current user';
  END IF;

  SELECT sender_id
  INTO   v_sender_id
  FROM   public.couple_connection_requests
  WHERE  id          = p_request_id
    AND  status      = 'pending'
    AND  receiver_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found, not pending, or not addressed to the current user';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.couple_connections
    WHERE (user_a = v_sender_id OR user_b = v_sender_id) AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Sender already has an active connection';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.couple_connections
    WHERE (user_a = auth.uid() OR user_b = auth.uid()) AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Receiver already has an active connection';
  END IF;

  UPDATE public.couple_connection_requests
  SET    status     = 'accepted',
         updated_at = now()
  WHERE  id = p_request_id;

  INSERT INTO public.couple_connections (user_a, user_b)
  VALUES (v_sender_id, auth.uid())
  RETURNING id INTO v_connection_id;

  -- Audit log
  PERFORM public.write_couple_audit_log(
    v_connection_id,
    'request_accepted',
    p_request_id,
    jsonb_build_object('sender_id', v_sender_id, 'receiver_id', auth.uid())
  );

  RETURN v_connection_id;
END;
$$;

-- ============================================================
-- 2. Update update_shared_expense_by_partner to log
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_shared_expense_by_partner(
  p_id                   UUID,
  p_couple_category_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_connection_id UUID;
  v_created_by    UUID;
BEGIN
  IF NOT public.is_couple_expenses_enabled() THEN
    RAISE EXCEPTION 'couple_expenses not enabled for the current user';
  END IF;

  SELECT connection_id, created_by
  INTO   v_connection_id, v_created_by
  FROM   public.shared_expenses
  WHERE  id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shared expense not found';
  END IF;

  IF v_created_by = auth.uid() THEN
    RAISE EXCEPTION 'Use a direct UPDATE for your own shared expenses';
  END IF;

  IF NOT public.is_in_connection(v_connection_id) THEN
    RAISE EXCEPTION 'Not a member of an active connection';
  END IF;

  UPDATE public.shared_expenses
  SET    couple_category_name = COALESCE(p_couple_category_name, couple_category_name),
         updated_at           = now()
  WHERE  id = p_id;

  -- Audit log
  PERFORM public.write_couple_audit_log(
    v_connection_id,
    'shared_expense_updated',
    p_id,
    jsonb_build_object('couple_category_name', p_couple_category_name)
  );
END;
$$;

-- ============================================================
-- 3. Update delete_shared_expense_by_partner to log
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_shared_expense_by_partner(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_connection_id UUID;
  v_created_by    UUID;
BEGIN
  IF NOT public.is_couple_expenses_enabled() THEN
    RAISE EXCEPTION 'couple_expenses not enabled for the current user';
  END IF;

  SELECT connection_id, created_by
  INTO   v_connection_id, v_created_by
  FROM   public.shared_expenses
  WHERE  id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shared expense not found';
  END IF;

  IF v_created_by = auth.uid() THEN
    RAISE EXCEPTION 'Use a direct DELETE for your own shared expenses';
  END IF;

  IF NOT public.is_in_connection(v_connection_id) THEN
    RAISE EXCEPTION 'Not a member of an active connection';
  END IF;

  DELETE FROM public.shared_expenses WHERE id = p_id;

  -- Audit log
  PERFORM public.write_couple_audit_log(
    v_connection_id,
    'shared_expense_deleted',
    p_id,
    '{}'::jsonb
  );
END;
$$;

-- ============================================================
-- 4. Trigger: log request_sent on INSERT into couple_connection_requests
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_couple_request_sent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Look up the active connection (may not exist yet at request time — that's fine)
  PERFORM public.write_couple_audit_log(
    NULL,  -- no connection yet
    'request_sent',
    NEW.id,
    jsonb_build_object('sender_id', NEW.sender_id, 'receiver_id', NEW.receiver_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_request_sent ON public.couple_connection_requests;
CREATE TRIGGER trg_audit_request_sent
  AFTER INSERT ON public.couple_connection_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_couple_request_sent();

-- ============================================================
-- 5. Trigger: log request_rejected / request_cancelled on UPDATE
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_couple_request_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('rejected', 'cancelled') THEN
    PERFORM public.write_couple_audit_log(
      NULL,
      'request_' || NEW.status,
      NEW.id,
      jsonb_build_object('sender_id', NEW.sender_id, 'receiver_id', NEW.receiver_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_request_status ON public.couple_connection_requests;
CREATE TRIGGER trg_audit_request_status
  AFTER UPDATE ON public.couple_connection_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_couple_request_status_change();

-- ============================================================
-- 6. Trigger: log connection_revoked when revoked_at is set
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_couple_connection_revoked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL THEN
    PERFORM public.write_couple_audit_log(
      NEW.id,
      'connection_revoked',
      NEW.id,
      jsonb_build_object('user_a', NEW.user_a, 'user_b', NEW.user_b)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_connection_revoked ON public.couple_connections;
CREATE TRIGGER trg_audit_connection_revoked
  AFTER UPDATE ON public.couple_connections
  FOR EACH ROW EXECUTE FUNCTION public.audit_couple_connection_revoked();

-- ============================================================
-- 7. Trigger: log shared_expense_created on INSERT into shared_expenses
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_shared_expense_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.write_couple_audit_log(
    NEW.connection_id,
    'shared_expense_created',
    NEW.id,
    jsonb_build_object(
      'original_tx_id',      NEW.original_tx_id,
      'couple_category_name', NEW.couple_category_name
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_shared_expense_created ON public.shared_expenses;
CREATE TRIGGER trg_audit_shared_expense_created
  AFTER INSERT ON public.shared_expenses
  FOR EACH ROW EXECUTE FUNCTION public.audit_shared_expense_created();
