-- Add new currency codes to the enum
ALTER TYPE public.currency_code ADD VALUE IF NOT EXISTS 'IDR';

-- Add exchange_rate_eur to transactions:
-- stores the rate (transaction_currency → EUR) at the time the transaction was created.
-- For EUR transactions this is always 1.0.
-- amount_in_eur = amount * exchange_rate_eur
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS exchange_rate_eur DECIMAL(15, 6) NOT NULL DEFAULT 1.0;
