-- Add couple_code column to profiles.
-- Each profile gets a unique 8-character code (charset excludes 0, O, 1, I, L
-- to avoid visual ambiguity). The code is generated automatically on INSERT
-- via the trigger below and backfilled for existing rows.

-- 1. Add column (nullable first to allow backfill)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS couple_code TEXT;

-- 2. Function: generate a random 8-char code from an unambiguous charset
CREATE OR REPLACE FUNCTION public.generate_couple_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charset TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- 32 chars, no 0/O/1/I/L
  v_len     INTEGER := 8;
  v_code    TEXT;
  v_exists  BOOLEAN;
BEGIN
  LOOP
    -- Build a random 8-character string
    v_code := '';
    FOR i IN 1..v_len LOOP
      v_code := v_code || substr(v_charset, floor(random() * length(v_charset) + 1)::integer, 1);
    END LOOP;

    -- Check for collision
    SELECT EXISTS (
      SELECT 1 FROM public.profiles WHERE couple_code = v_code
    ) INTO v_exists;

    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_code;
END;
$$;

-- 3. Trigger function: set couple_code before INSERT if not already provided
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

-- 4. Attach trigger BEFORE INSERT on profiles
DROP TRIGGER IF EXISTS trg_set_couple_code ON public.profiles;
CREATE TRIGGER trg_set_couple_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_couple_code();

-- 5. Backfill existing rows that have no couple_code
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

-- 6. Now that all rows have a value, enforce NOT NULL and UNIQUE
ALTER TABLE public.profiles
ALTER COLUMN couple_code SET NOT NULL;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_couple_code_key UNIQUE (couple_code);

COMMENT ON COLUMN public.profiles.couple_code IS
  '8-character unique code used to identify a user for couple pairing requests. Auto-generated on insert.';
