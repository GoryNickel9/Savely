-- ============================================================================
-- S-14: rende visibili i tentativi di escalation dei permessi
-- ============================================================================
-- Il trigger protect_permissions (S-5) silenziosamente azzerava/preservava
-- i permessi dei non-admin senza generare errori, rendendo invisibili i
-- tentativi di auto-promozione. Ora RAISE EXCEPTION: l'operazione viene
-- rifiutata con un errore esplicito, utile per auditing/monitoring.
-- Il comportamento è identico per gli admin (nessuna restrizione).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.permissions IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only admins can set permissions on a new profile';
    END IF;
  ELSE
    IF OLD.permissions IS DISTINCT FROM NEW.permissions AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only admins can modify the permissions field';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
