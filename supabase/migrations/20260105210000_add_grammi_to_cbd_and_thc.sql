-- Aggiunge il campo grammi alla tabella cbd
ALTER TABLE cbd ADD COLUMN IF NOT EXISTS grammi DECIMAL(10, 2);

-- Aggiunge il campo grammi alla tabella thc
ALTER TABLE thc ADD COLUMN IF NOT EXISTS grammi DECIMAL(10, 2);