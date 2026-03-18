-- Add derived fields to cbd and thc tables
ALTER TABLE cbd ADD COLUMN giorni_durata INTEGER;
ALTER TABLE cbd ADD COLUMN grammi_al_giorno NUMERIC;
ALTER TABLE cbd ADD COLUMN euro_al_giorno NUMERIC;
ALTER TABLE cbd ADD COLUMN costo_mensile NUMERIC;

ALTER TABLE thc ADD COLUMN giorni_durata INTEGER;
ALTER TABLE thc ADD COLUMN grammi_al_giorno NUMERIC;
ALTER TABLE thc ADD COLUMN euro_al_giorno NUMERIC;
ALTER TABLE thc ADD COLUMN costo_mensile NUMERIC;