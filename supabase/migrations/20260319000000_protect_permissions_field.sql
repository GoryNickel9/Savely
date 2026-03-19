-- Prevent non-admin users from modifying their own permissions field.
-- This closes the privilege escalation vulnerability where a user could
-- call updateUserPermissions(myOwnId, {admin: true}) to self-promote.

CREATE OR REPLACE FUNCTION public.protect_permissions_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If permissions field is being changed
  IF OLD.permissions IS DISTINCT FROM NEW.permissions THEN
    -- Allow only if the caller is an admin
    IF NOT public.is_admin() THEN
      -- Non-admin: silently preserve old permissions
      NEW.permissions := OLD.permissions;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if present
DROP TRIGGER IF EXISTS protect_permissions_update_trigger ON public.profiles;

-- Create trigger BEFORE UPDATE
CREATE TRIGGER protect_permissions_update_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_permissions_update();

-- Also fix is_admin() to set search_path (defense in depth)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((permissions->>'admin')::boolean, false) = true
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;
