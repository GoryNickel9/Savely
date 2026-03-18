-- Creazione tabella tgc_cards per gestire le carte da gioco
CREATE TABLE tgc_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('magic', 'yugioh', 'pokemon', 'lorcana')),
  card_id TEXT, -- ID della carta dall'API (scryfall_id, yugioh_id, pokemon_id)
  set_code TEXT, -- Codice dell'espansione
  collector_number TEXT, -- Numero del collezionista
  condition TEXT DEFAULT 'near_mint' CHECK (condition IN ('near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged')),
  quantity INTEGER DEFAULT 1 NOT NULL,
  purchase_price DECIMAL(10, 2) NOT NULL,
  purchase_date DATE NOT NULL,
  current_price DECIMAL(10, 2),
  currency TEXT DEFAULT 'EUR',
  image_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX idx_tgc_cards_user_id ON tgc_cards(user_id);
CREATE INDEX idx_tgc_cards_category ON tgc_cards(category);
CREATE INDEX idx_tgc_cards_card_id ON tgc_cards(card_id);

-- RLS Policies
ALTER TABLE tgc_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own TGC cards"
  ON tgc_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own TGC cards"
  ON tgc_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own TGC cards"
  ON tgc_cards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own TGC cards"
  ON tgc_cards FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tgc_cards_updated_at
  BEFORE UPDATE ON tgc_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();