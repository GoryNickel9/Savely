-- Aggiunge il campo costo_mensile alla tabella liquido_sigaretta
ALTER TABLE liquido_sigaretta ADD COLUMN IF NOT EXISTS costo_mensile DECIMAL(10, 2);