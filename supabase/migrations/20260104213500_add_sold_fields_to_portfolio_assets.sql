-- Add sold_at and sold_price fields to portfolio_assets table
ALTER TABLE public.portfolio_assets 
ADD COLUMN IF NOT EXISTS sold_at DATE,
ADD COLUMN IF NOT EXISTS sold_price DECIMAL(15, 2);

-- Add comment to document the purpose of these fields
COMMENT ON COLUMN public.portfolio_assets.sold_at IS 'Date when the asset was sold (null if still held)';
COMMENT ON COLUMN public.portfolio_assets.sold_price IS 'Price at which the asset was sold (null if still held)';