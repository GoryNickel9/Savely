-- Aggiunge il permesso fumo ai profili esistenti
-- Questo permette agli admin di attivare il menu Fumo per gli utenti

-- Aggiunge la colonna fumo se non esiste
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS fumo BOOLEAN DEFAULT false;

-- Aggiorna i profili esistenti per impostare fumo a false
UPDATE profiles 
SET fumo = false 
WHERE fumo IS NULL;