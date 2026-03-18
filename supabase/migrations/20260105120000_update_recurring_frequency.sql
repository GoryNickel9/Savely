-- Add week_interval column to store number of weeks for weekly frequency
ALTER TABLE public.recurring_expenses ADD COLUMN IF NOT EXISTS week_interval INTEGER DEFAULT 1;

-- Update the enum to remove 'biweekly'
-- Note: PostgreSQL doesn't support removing values from ENUM directly
-- We need to recreate the type

-- First, create a new enum type without 'biweekly'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recurring_frequency_new') THEN
    CREATE TYPE public.recurring_frequency_new AS ENUM ('weekly', 'monthly', 'quarterly', 'yearly');
  END IF;
END $$;

-- Update the frequency column to use the new type
ALTER TABLE public.recurring_expenses ALTER COLUMN frequency TYPE recurring_frequency_new USING 
  CASE 
    WHEN frequency::text = 'biweekly' THEN 'weekly'::recurring_frequency_new
    ELSE frequency::text::recurring_frequency_new
  END;

-- Drop the old type
DROP TYPE IF EXISTS public.recurring_frequency;

-- Rename the new type to the original name
ALTER TYPE public.recurring_frequency_new RENAME TO recurring_frequency;

-- Set week_interval to 2 for any expenses that were previously biweekly
UPDATE public.recurring_expenses 
SET week_interval = 2 
WHERE week_interval = 1 AND frequency = 'weekly';