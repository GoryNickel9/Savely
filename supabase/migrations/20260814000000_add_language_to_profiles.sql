-- Aggiunge la lingua preferita dell'interfaccia al profilo utente.
-- La preferenza sopravvive a cambio dispositivo/pulizia dei dati del browser:
-- viene applicata automaticamente al login (vedi MainLayout).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'it';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_language_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_language_check CHECK (language IN ('it', 'en'));
