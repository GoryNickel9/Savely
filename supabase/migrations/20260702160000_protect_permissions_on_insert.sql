-- ============================================================================
-- S-5: protegge permissions anche sul path INSERT (non solo UPDATE)
-- ============================================================================
-- Il trigger protect_permissions_update era BEFORE UPDATE only. La policy
-- INSERT su profiles non vincola il campo permissions, quindi un ipotetico
-- INSERT con permissions pre-compilato veniva accettato. Oggi non sfruttabile
-- (user_id UNIQUE + handle_new_user crea la riga), ma è una difesa indiretta.
-- Estendiamo a BEFORE INSERT OR UPDATE: defense-in-depth esplicita.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    -- Solo un admin può pre-impostare permissions su una nuova riga.
    -- Per i signup normali (permissions NULL) non fa nulla.
    IF NEW.permissions IS NOT NULL AND NOT public.is_admin() THEN
      NEW.permissions := NULL;
    END IF;
  ELSE
    -- UPDATE: un non-admin non può modificare permissions.
    IF OLD.permissions IS DISTINCT FROM NEW.permissions AND NOT public.is_admin() THEN
      NEW.permissions := OLD.permissions;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_permissions_update_trigger ON public.profiles;
DROP TRIGGER IF EXISTS protect_permissions_trigger ON public.profiles;

CREATE TRIGGER protect_permissions_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_permissions();

-- Rimuovi la vecchia funzione obsolete
DROP FUNCTION IF EXISTS public.protect_permissions_update();
