-- =============================================================================
-- SCRIPT UNIFICATO: Couple Expenses Feature
-- Supabase Studio → SQL Editor → incolla ed esegui
-- Progetto: crqnfbahytzenisospcx
-- =============================================================================

-- ============================================================
-- MIGRATION 1: add_couple_expenses_permission
-- ============================================================
UPDATE public.profiles
SET permissions = COALESCE(permissions, '{}'::jsonb) || '{"couple_expenses": false}'::jsonb
WHERE permissions->>'couple_expenses' IS NULL;

-- ============================================================
-- MIGRATION 2: add_couple_code_to_profiles
-- ============================================================

-- Aggiungi la colonna (nullable per ora)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS couple_code TEXT;

-- Funzione per generare il codice
CREATE OR REPLACE FUNCTION public.generate_couple_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charset TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_len     INTEGER := 8;
  v_code    TEXT;
  v_exists  BOOLEAN;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..v_len LOOP
      v_code := v_code || substr(v_charset, floor(random() * length(v_charset) + 1)::integer, 1);
    END LOOP;
    SELECT EXISTS (
      SELECT 1 FROM public.profiles WHERE couple_code = v_code
    ) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

-- Trigger function
CREATE OR REPLACE FUNCTION public.set_couple_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.couple_code IS NULL OR NEW.couple_code = '' THEN
    NEW.couple_code := public.generate_couple_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger BEFORE INSERT su profiles
DROP TRIGGER IF EXISTS trg_set_couple_code ON public.profiles;
CREATE TRIGGER trg_set_couple_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_couple_code();

-- Backfill utenti esistenti
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE couple_code IS NULL LOOP
    UPDATE public.profiles
    SET couple_code = public.generate_couple_code()
    WHERE id = r.id;
  END LOOP;
END;
$$;

-- Ora imposta NOT NULL e UNIQUE
ALTER TABLE public.profiles
ALTER COLUMN couple_code SET NOT NULL;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_couple_code_key;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_couple_code_key UNIQUE (couple_code);

-- ============================================================
-- MIGRATION 3: couple_helper_functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_couple_expenses_enabled()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((permissions->>'couple_expenses')::boolean, false) = true
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_in_connection(p_connection_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.couple_connections cc
    WHERE cc.id = p_connection_id
      AND cc.revoked_at IS NULL
      AND (cc.user_a = auth.uid() OR cc.user_b = auth.uid())
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_in_connection_any(p_connection_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.couple_connections cc
    WHERE cc.id = p_connection_id
      AND (cc.user_a = auth.uid() OR cc.user_b = auth.uid())
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.find_user_by_couple_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_user_id UUID;
BEGIN
  IF NOT public.is_couple_expenses_enabled() THEN
    RETURN NULL;
  END IF;
  SELECT p.user_id INTO v_target_user_id
  FROM public.profiles p
  WHERE p.couple_code = upper(trim(p_code))
    AND COALESCE((p.permissions->>'couple_expenses')::boolean, false) = true
  LIMIT 1;
  RETURN v_target_user_id;
END;
$$;

-- ============================================================
-- MIGRATION 4: create_couple_connection_requests
-- ============================================================

CREATE TABLE IF NOT EXISTS public.couple_connection_requests (
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

CREATE INDEX IF NOT EXISTS idx_ccr_sender   ON public.couple_connection_requests (sender_id);
CREATE INDEX IF NOT EXISTS idx_ccr_receiver ON public.couple_connection_requests (receiver_id);
CREATE INDEX IF NOT EXISTS idx_ccr_status   ON public.couple_connection_requests (status);

CREATE OR REPLACE FUNCTION public.touch_updated_at_ccr()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_ccr_updated_at ON public.couple_connection_requests;
CREATE TRIGGER trg_ccr_updated_at
  BEFORE UPDATE ON public.couple_connection_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_ccr();

ALTER TABLE public.couple_connection_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ccr_select_own" ON public.couple_connection_requests;
CREATE POLICY "ccr_select_own" ON public.couple_connection_requests
  FOR SELECT USING (
    public.is_couple_expenses_enabled()
    AND (sender_id = auth.uid() OR receiver_id = auth.uid())
  );

DROP POLICY IF EXISTS "ccr_insert" ON public.couple_connection_requests;
CREATE POLICY "ccr_insert" ON public.couple_connection_requests
  FOR INSERT WITH CHECK (
    public.is_couple_expenses_enabled()
    AND sender_id = auth.uid()
    AND (
      SELECT COUNT(*)
      FROM public.couple_connection_requests existing
      WHERE existing.sender_id = auth.uid()
        AND existing.created_at > now() - INTERVAL '24 hours'
    ) < 10
    AND NOT EXISTS (
      SELECT 1 FROM public.couple_connections cc
      WHERE (cc.user_a = auth.uid() OR cc.user_b = auth.uid())
        AND cc.revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "ccr_update_sender_cancel" ON public.couple_connection_requests;
CREATE POLICY "ccr_update_sender_cancel" ON public.couple_connection_requests
  FOR UPDATE USING (
    public.is_couple_expenses_enabled()
    AND sender_id = auth.uid()
    AND status = 'pending'
  ) WITH CHECK (status = 'cancelled');

DROP POLICY IF EXISTS "ccr_update_receiver_reject" ON public.couple_connection_requests;
CREATE POLICY "ccr_update_receiver_reject" ON public.couple_connection_requests
  FOR UPDATE USING (
    public.is_couple_expenses_enabled()
    AND receiver_id = auth.uid()
    AND status = 'pending'
  ) WITH CHECK (status = 'rejected');

-- ============================================================
-- MIGRATION 5: create_couple_connections
-- ============================================================

CREATE TABLE IF NOT EXISTS public.couple_connections (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP INDEX IF EXISTS couple_connections_user_a_active;
CREATE UNIQUE INDEX couple_connections_user_a_active
  ON public.couple_connections (user_a)
  WHERE revoked_at IS NULL;

DROP INDEX IF EXISTS couple_connections_user_b_active;
CREATE UNIQUE INDEX couple_connections_user_b_active
  ON public.couple_connections (user_b)
  WHERE revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.touch_updated_at_cc()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_cc_updated_at ON public.couple_connections;
CREATE TRIGGER trg_cc_updated_at
  BEFORE UPDATE ON public.couple_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_cc();

ALTER TABLE public.couple_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cc_select_members" ON public.couple_connections;
CREATE POLICY "cc_select_members" ON public.couple_connections
  FOR SELECT USING (
    public.is_couple_expenses_enabled()
    AND (user_a = auth.uid() OR user_b = auth.uid())
  );

DROP POLICY IF EXISTS "cc_insert_blocked" ON public.couple_connections;
CREATE POLICY "cc_insert_blocked" ON public.couple_connections
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "cc_update_revoke" ON public.couple_connections;
CREATE POLICY "cc_update_revoke" ON public.couple_connections
  FOR UPDATE USING (
    public.is_couple_expenses_enabled()
    AND (user_a = auth.uid() OR user_b = auth.uid())
    AND revoked_at IS NULL
  ) WITH CHECK (
    revoked_at IS NOT NULL
  );

CREATE OR REPLACE FUNCTION public.accept_couple_request(p_request_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id    UUID;
  v_connection_id UUID;
BEGIN
  IF NOT public.is_couple_expenses_enabled() THEN
    RAISE EXCEPTION 'couple_expenses not enabled';
  END IF;
  SELECT sender_id INTO v_sender_id
  FROM public.couple_connection_requests
  WHERE id = p_request_id AND status = 'pending' AND receiver_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found, not pending, or not addressed to current user';
  END IF;
  IF EXISTS (SELECT 1 FROM public.couple_connections WHERE (user_a=v_sender_id OR user_b=v_sender_id) AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'Sender already has an active connection';
  END IF;
  IF EXISTS (SELECT 1 FROM public.couple_connections WHERE (user_a=auth.uid() OR user_b=auth.uid()) AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'Receiver already has an active connection';
  END IF;
  UPDATE public.couple_connection_requests SET status='accepted', updated_at=now() WHERE id=p_request_id;
  INSERT INTO public.couple_connections (user_a, user_b) VALUES (v_sender_id, auth.uid()) RETURNING id INTO v_connection_id;
  RETURN v_connection_id;
END;
$$;

-- ============================================================
-- MIGRATION 6: create_shared_expenses
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shared_expenses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id       UUID NOT NULL REFERENCES public.couple_connections(id) ON DELETE RESTRICT,
  original_tx_id      UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  created_by          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  split_percentage    DECIMAL(5, 2) NOT NULL DEFAULT 50.00 CHECK (split_percentage = 50.00),
  couple_category_name TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shared_expenses_tx_unique UNIQUE (original_tx_id)
);

CREATE INDEX IF NOT EXISTS idx_se_connection ON public.shared_expenses (connection_id);
CREATE INDEX IF NOT EXISTS idx_se_created_by ON public.shared_expenses (created_by);

CREATE OR REPLACE FUNCTION public.touch_updated_at_se()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_se_updated_at ON public.shared_expenses;
CREATE TRIGGER trg_se_updated_at BEFORE UPDATE ON public.shared_expenses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_se();

CREATE OR REPLACE FUNCTION public.on_tx_soft_delete_remove_shared_expense()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    DELETE FROM public.shared_expenses WHERE original_tx_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tx_soft_delete_cascade_shared ON public.transactions;
CREATE TRIGGER trg_tx_soft_delete_cascade_shared
  AFTER UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.on_tx_soft_delete_remove_shared_expense();

ALTER TABLE public.shared_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "se_select" ON public.shared_expenses;
CREATE POLICY "se_select" ON public.shared_expenses
  FOR SELECT USING (public.is_couple_expenses_enabled() AND public.is_in_connection_any(connection_id));

DROP POLICY IF EXISTS "se_insert" ON public.shared_expenses;
CREATE POLICY "se_insert" ON public.shared_expenses
  FOR INSERT WITH CHECK (
    public.is_couple_expenses_enabled() AND public.is_in_connection(connection_id)
    AND created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.transactions t WHERE t.id=original_tx_id AND t.user_id=auth.uid() AND t.type='expense' AND t.deleted_at IS NULL)
  );

DROP POLICY IF EXISTS "se_update_creator" ON public.shared_expenses;
CREATE POLICY "se_update_creator" ON public.shared_expenses
  FOR UPDATE USING (public.is_couple_expenses_enabled() AND public.is_in_connection(connection_id) AND created_by=auth.uid());

DROP POLICY IF EXISTS "se_delete_creator" ON public.shared_expenses;
CREATE POLICY "se_delete_creator" ON public.shared_expenses
  FOR DELETE USING (public.is_couple_expenses_enabled() AND public.is_in_connection(connection_id) AND created_by=auth.uid());

CREATE OR REPLACE VIEW public.shared_expenses_view AS
SELECT
  se.id, se.connection_id, se.original_tx_id, se.created_by,
  se.couple_category_name, se.split_percentage, se.created_at, se.updated_at,
  t.amount AS total_amount, ROUND(t.amount / 2.0, 2) AS my_share_amount,
  t.currency::TEXT AS currency, t.exchange_rate_eur,
  t.description, t.date, t.deleted_at AS tx_deleted_at
FROM public.shared_expenses se
JOIN public.transactions t ON t.id = se.original_tx_id
WHERE public.is_couple_expenses_enabled() AND public.is_in_connection_any(se.connection_id);

GRANT SELECT ON public.shared_expenses_view TO authenticated;

CREATE OR REPLACE FUNCTION public.update_shared_expense_by_partner(p_id UUID, p_couple_category_name TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_connection_id UUID; v_created_by UUID;
BEGIN
  IF NOT public.is_couple_expenses_enabled() THEN RAISE EXCEPTION 'couple_expenses not enabled'; END IF;
  SELECT connection_id, created_by INTO v_connection_id, v_created_by FROM public.shared_expenses WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shared expense not found'; END IF;
  IF v_created_by = auth.uid() THEN RAISE EXCEPTION 'Use direct UPDATE for your own shared expenses'; END IF;
  IF NOT public.is_in_connection(v_connection_id) THEN RAISE EXCEPTION 'Not a member of an active connection'; END IF;
  UPDATE public.shared_expenses SET couple_category_name=COALESCE(p_couple_category_name, couple_category_name), updated_at=now() WHERE id=p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_shared_expense_by_partner(p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_connection_id UUID; v_created_by UUID;
BEGIN
  IF NOT public.is_couple_expenses_enabled() THEN RAISE EXCEPTION 'couple_expenses not enabled'; END IF;
  SELECT connection_id, created_by INTO v_connection_id, v_created_by FROM public.shared_expenses WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shared expense not found'; END IF;
  IF v_created_by = auth.uid() THEN RAISE EXCEPTION 'Use direct DELETE for your own shared expenses'; END IF;
  IF NOT public.is_in_connection(v_connection_id) THEN RAISE EXCEPTION 'Not a member of an active connection'; END IF;
  DELETE FROM public.shared_expenses WHERE id=p_id;
END;
$$;

-- ============================================================
-- MIGRATION 7: create_couple_budgets
-- ============================================================

CREATE TABLE IF NOT EXISTS public.couple_budgets (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id        UUID NOT NULL REFERENCES public.couple_connections(id) ON DELETE CASCADE,
  couple_category_name TEXT NOT NULL,
  amount               DECIMAL(15, 2) NOT NULL,
  currency             public.currency_code DEFAULT 'EUR',
  month                INTEGER NOT NULL DEFAULT 1,
  year                 INTEGER NOT NULL DEFAULT 2000,
  created_by           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, couple_category_name, month, year)
);

CREATE INDEX IF NOT EXISTS idx_cb_connection ON public.couple_budgets (connection_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at_cb()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_cb_updated_at ON public.couple_budgets;
CREATE TRIGGER trg_cb_updated_at BEFORE UPDATE ON public.couple_budgets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_cb();

ALTER TABLE public.couple_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cb_select" ON public.couple_budgets;
CREATE POLICY "cb_select" ON public.couple_budgets FOR SELECT USING (public.is_couple_expenses_enabled() AND public.is_in_connection_any(connection_id));
DROP POLICY IF EXISTS "cb_insert" ON public.couple_budgets;
CREATE POLICY "cb_insert" ON public.couple_budgets FOR INSERT WITH CHECK (public.is_couple_expenses_enabled() AND public.is_in_connection(connection_id) AND created_by=auth.uid());
DROP POLICY IF EXISTS "cb_update" ON public.couple_budgets;
CREATE POLICY "cb_update" ON public.couple_budgets FOR UPDATE USING (public.is_couple_expenses_enabled() AND public.is_in_connection(connection_id));
DROP POLICY IF EXISTS "cb_delete" ON public.couple_budgets;
CREATE POLICY "cb_delete" ON public.couple_budgets FOR DELETE USING (public.is_couple_expenses_enabled() AND public.is_in_connection(connection_id));

-- ============================================================
-- MIGRATION 8: create_couple_audit_log
-- ============================================================

CREATE TABLE IF NOT EXISTS public.couple_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES public.couple_connections(id) ON DELETE SET NULL,
  actor_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,
  target_id     UUID,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cal_connection ON public.couple_audit_log (connection_id);
CREATE INDEX IF NOT EXISTS idx_cal_actor      ON public.couple_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_cal_created_at ON public.couple_audit_log (created_at DESC);

ALTER TABLE public.couple_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cal_select" ON public.couple_audit_log;
CREATE POLICY "cal_select" ON public.couple_audit_log FOR SELECT USING (public.is_couple_expenses_enabled() AND public.is_in_connection_any(connection_id));
DROP POLICY IF EXISTS "cal_insert_blocked" ON public.couple_audit_log;
CREATE POLICY "cal_insert_blocked" ON public.couple_audit_log FOR INSERT WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.write_couple_audit_log(p_connection_id UUID, p_action TEXT, p_target_id UUID DEFAULT NULL, p_metadata JSONB DEFAULT '{}'::jsonb)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.couple_audit_log (connection_id, actor_id, action, target_id, metadata)
  VALUES (p_connection_id, auth.uid(), p_action, p_target_id, COALESCE(p_metadata, '{}'::jsonb));
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

-- ============================================================
-- MIGRATION 9: retrofit_audit_log_rpcs + triggers
-- ============================================================

-- Update accept_couple_request with audit
CREATE OR REPLACE FUNCTION public.accept_couple_request(p_request_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sender_id UUID; v_connection_id UUID;
BEGIN
  IF NOT public.is_couple_expenses_enabled() THEN RAISE EXCEPTION 'couple_expenses not enabled'; END IF;
  SELECT sender_id INTO v_sender_id FROM public.couple_connection_requests WHERE id=p_request_id AND status='pending' AND receiver_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found, not pending, or not addressed to current user'; END IF;
  IF EXISTS (SELECT 1 FROM public.couple_connections WHERE (user_a=v_sender_id OR user_b=v_sender_id) AND revoked_at IS NULL) THEN RAISE EXCEPTION 'Sender already has an active connection'; END IF;
  IF EXISTS (SELECT 1 FROM public.couple_connections WHERE (user_a=auth.uid() OR user_b=auth.uid()) AND revoked_at IS NULL) THEN RAISE EXCEPTION 'Receiver already has an active connection'; END IF;
  UPDATE public.couple_connection_requests SET status='accepted', updated_at=now() WHERE id=p_request_id;
  INSERT INTO public.couple_connections (user_a, user_b) VALUES (v_sender_id, auth.uid()) RETURNING id INTO v_connection_id;
  PERFORM public.write_couple_audit_log(v_connection_id, 'request_accepted', p_request_id, jsonb_build_object('sender_id', v_sender_id, 'receiver_id', auth.uid()));
  RETURN v_connection_id;
END;
$$;

-- Update partner RPCs with audit
CREATE OR REPLACE FUNCTION public.update_shared_expense_by_partner(p_id UUID, p_couple_category_name TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_connection_id UUID; v_created_by UUID;
BEGIN
  IF NOT public.is_couple_expenses_enabled() THEN RAISE EXCEPTION 'couple_expenses not enabled'; END IF;
  SELECT connection_id, created_by INTO v_connection_id, v_created_by FROM public.shared_expenses WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shared expense not found'; END IF;
  IF v_created_by=auth.uid() THEN RAISE EXCEPTION 'Use direct UPDATE'; END IF;
  IF NOT public.is_in_connection(v_connection_id) THEN RAISE EXCEPTION 'Not a member of an active connection'; END IF;
  UPDATE public.shared_expenses SET couple_category_name=COALESCE(p_couple_category_name, couple_category_name), updated_at=now() WHERE id=p_id;
  PERFORM public.write_couple_audit_log(v_connection_id, 'shared_expense_updated', p_id, jsonb_build_object('couple_category_name', p_couple_category_name));
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_shared_expense_by_partner(p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_connection_id UUID; v_created_by UUID;
BEGIN
  IF NOT public.is_couple_expenses_enabled() THEN RAISE EXCEPTION 'couple_expenses not enabled'; END IF;
  SELECT connection_id, created_by INTO v_connection_id, v_created_by FROM public.shared_expenses WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shared expense not found'; END IF;
  IF v_created_by=auth.uid() THEN RAISE EXCEPTION 'Use direct DELETE'; END IF;
  IF NOT public.is_in_connection(v_connection_id) THEN RAISE EXCEPTION 'Not a member of an active connection'; END IF;
  DELETE FROM public.shared_expenses WHERE id=p_id;
  PERFORM public.write_couple_audit_log(v_connection_id, 'shared_expense_deleted', p_id, '{}'::jsonb);
END;
$$;

-- Triggers audit
CREATE OR REPLACE FUNCTION public.audit_couple_request_sent()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.write_couple_audit_log(NULL,'request_sent',NEW.id,jsonb_build_object('sender_id',NEW.sender_id,'receiver_id',NEW.receiver_id)); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_audit_request_sent ON public.couple_connection_requests;
CREATE TRIGGER trg_audit_request_sent AFTER INSERT ON public.couple_connection_requests FOR EACH ROW EXECUTE FUNCTION public.audit_couple_request_sent();

CREATE OR REPLACE FUNCTION public.audit_couple_request_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status='pending' AND NEW.status IN ('rejected','cancelled') THEN
    PERFORM public.write_couple_audit_log(NULL,'request_'||NEW.status,NEW.id,jsonb_build_object('sender_id',NEW.sender_id,'receiver_id',NEW.receiver_id));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_request_status ON public.couple_connection_requests;
CREATE TRIGGER trg_audit_request_status AFTER UPDATE ON public.couple_connection_requests FOR EACH ROW EXECUTE FUNCTION public.audit_couple_request_status_change();

CREATE OR REPLACE FUNCTION public.audit_couple_connection_revoked()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL THEN
    PERFORM public.write_couple_audit_log(NEW.id,'connection_revoked',NEW.id,jsonb_build_object('user_a',NEW.user_a,'user_b',NEW.user_b));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_connection_revoked ON public.couple_connections;
CREATE TRIGGER trg_audit_connection_revoked AFTER UPDATE ON public.couple_connections FOR EACH ROW EXECUTE FUNCTION public.audit_couple_connection_revoked();

CREATE OR REPLACE FUNCTION public.audit_shared_expense_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.write_couple_audit_log(NEW.connection_id,'shared_expense_created',NEW.id,jsonb_build_object('original_tx_id',NEW.original_tx_id,'couple_category_name',NEW.couple_category_name));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_shared_expense_created ON public.shared_expenses;
CREATE TRIGGER trg_audit_shared_expense_created AFTER INSERT ON public.shared_expenses FOR EACH ROW EXECUTE FUNCTION public.audit_shared_expense_created();

-- =============================================================================
-- FINE SCRIPT
-- Verifica: SELECT couple_code FROM profiles WHERE user_id = auth.uid();
-- =============================================================================
