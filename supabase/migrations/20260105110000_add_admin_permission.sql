-- Aggiunge il permesso admin al primo utente (per test)
-- In produzione, dovresti specificare l'ID dell'utente corretto

UPDATE public.profiles
SET permissions = COALESCE(permissions, '{}'::jsonb) || '{"admin": true, "poker": true}'::jsonb
WHERE id = (
  SELECT id FROM public.profiles
  ORDER BY created_at ASC
  LIMIT 1
);

-- Se vuoi aggiungere il permesso admin a un utente specifico, usa:
-- UPDATE public.profiles
-- SET permissions = COALESCE(permissions, '{}'::jsonb) || '{"admin": true, "poker": true}'::jsonb
-- WHERE id = 'USER_ID_HERE';