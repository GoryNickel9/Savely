-- Tabella per tracciare i liquidi per sigaretta elettronica
CREATE TABLE IF NOT EXISTS liquido_sigaretta (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  costo DECIMAL(10, 2) NOT NULL DEFAULT 0,
  millilitri DECIMAL(10, 2) NOT NULL DEFAULT 0,
  data_arrivo DATE NOT NULL,
  data_finito DATE,
  giorni_durata INTEGER,
  millilitri_al_giorno DECIMAL(10, 2),
  euro_al_giorno DECIMAL(10, 2),
  costo_mensile DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella per tracciare i prodotti CBD
CREATE TABLE IF NOT EXISTS cbd (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  costo DECIMAL(10, 2) NOT NULL DEFAULT 0,
  marca TEXT,
  thc_content DECIMAL(5, 2),
  grammi DECIMAL(10, 2),
  descrizione TEXT,
  data_acquisto DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella per tracciare i prodotti THC
CREATE TABLE IF NOT EXISTS thc (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  costo DECIMAL(10, 2) NOT NULL DEFAULT 0,
  marca TEXT,
  thc_content DECIMAL(5, 2),
  grammi DECIMAL(10, 2),
  descrizione TEXT,
  data_acquisto DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Abilita RLS
ALTER TABLE liquido_sigaretta ENABLE ROW LEVEL SECURITY;
ALTER TABLE cbd ENABLE ROW LEVEL SECURITY;
ALTER TABLE thc ENABLE ROW LEVEL SECURITY;

-- Politiche RLS per liquido_sigaretta
CREATE POLICY "Users can view their own liquido_sigaretta records"
  ON liquido_sigaretta FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own liquido_sigaretta records"
  ON liquido_sigaretta FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own liquido_sigaretta records"
  ON liquido_sigaretta FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own liquido_sigaretta records"
  ON liquido_sigaretta FOR DELETE
  USING (auth.uid() = user_id);

-- Politiche RLS per cbd
CREATE POLICY "Users can view their own cbd records"
  ON cbd FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cbd records"
  ON cbd FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cbd records"
  ON cbd FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cbd records"
  ON cbd FOR DELETE
  USING (auth.uid() = user_id);

-- Politiche RLS per thc
CREATE POLICY "Users can view their own thc records"
  ON thc FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own thc records"
  ON thc FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own thc records"
  ON thc FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own thc records"
  ON thc FOR DELETE
  USING (auth.uid() = user_id);

-- Indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_liquido_sigaretta_user_id ON liquido_sigaretta(user_id);
CREATE INDEX IF NOT EXISTS idx_liquido_sigaretta_data_arrivo ON liquido_sigaretta(data_arrivo DESC);
CREATE INDEX IF NOT EXISTS idx_cbd_user_id ON cbd(user_id);
CREATE INDEX IF NOT EXISTS idx_cbd_data_acquisto ON cbd(data_acquisto DESC);
CREATE INDEX IF NOT EXISTS idx_thc_user_id ON thc(user_id);
CREATE INDEX IF NOT EXISTS idx_thc_data_acquisto ON thc(data_acquisto DESC);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_liquido_sigaretta_updated_at
  BEFORE UPDATE ON liquido_sigaretta
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cbd_updated_at
  BEFORE UPDATE ON cbd
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_thc_updated_at
  BEFORE UPDATE ON thc
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();