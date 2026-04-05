-- Create library_items table
CREATE TABLE library_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL CHECK (category IN ('libri', 'fumetti', 'manga')),
  title text NOT NULL,
  author text,
  publisher text,
  year integer,
  cover_image text,
  api_id text,
  purchase_price numeric(10,2),
  reselling_value numeric(10,2),
  quantity integer DEFAULT 1 NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE library_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own library items"
  ON library_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own library items"
  ON library_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own library items"
  ON library_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own library items"
  ON library_items FOR DELETE
  USING (auth.uid() = user_id);

-- Add libreria permission to profiles
UPDATE profiles
SET permissions = COALESCE(permissions, '{}'::jsonb) || '{"libreria": false}'::jsonb
WHERE permissions->>'libreria' IS NULL;
