-- Legacy clients may omit this field; existing categories retain regular behavior.
ALTER TABLE public.categories
  ADD COLUMN spending_pattern text NOT NULL DEFAULT 'regular'
  CHECK (spending_pattern IN ('regular', 'occasional'));

COMMENT ON COLUMN public.categories.spending_pattern IS
  'regular: existing monthly comparisons; occasional: calendar-month spending / 12, including zero months';
