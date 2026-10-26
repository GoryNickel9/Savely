BEGIN;

-- Test defaults and copied constraints without inserting or changing user data.
CREATE TEMP TABLE category_pattern_test (LIKE public.categories INCLUDING DEFAULTS INCLUDING CONSTRAINTS);

INSERT INTO category_pattern_test (id, user_id, name, type)
VALUES ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Synthetic pattern test', 'expense');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM category_pattern_test WHERE spending_pattern = 'regular') THEN
    RAISE EXCEPTION 'Existing clients must default to regular';
  END IF;
  UPDATE category_pattern_test SET spending_pattern = 'occasional';
  IF NOT EXISTS (SELECT 1 FROM category_pattern_test WHERE spending_pattern = 'occasional') THEN
    RAISE EXCEPTION 'Occasional pattern was not persisted';
  END IF;
  BEGIN
    UPDATE category_pattern_test SET spending_pattern = 'invalid';
    RAISE EXCEPTION 'Invalid pattern was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE category_pattern_test SET spending_pattern = NULL;
    RAISE EXCEPTION 'Null pattern was accepted';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.categories'::regclass) THEN
    RAISE EXCEPTION 'Category RLS must remain enabled';
  END IF;
END $$;

SELECT 'category_spending_pattern: defaults, persistence, validation, NOT NULL and existing RLS passed' AS result;
ROLLBACK;
