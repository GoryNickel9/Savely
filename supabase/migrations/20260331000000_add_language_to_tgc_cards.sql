-- Add language column to tgc_cards table
ALTER TABLE tgc_cards
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'EN';
