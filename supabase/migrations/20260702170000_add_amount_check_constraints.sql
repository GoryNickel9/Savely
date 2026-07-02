-- ============================================================================
-- S-6: CHECK constraint server-side su importi e quantità
-- ============================================================================
-- Tutta la validation era solo client-side. Un utente autenticato poteva
-- inserire via API importi NEGATIVI (un expense negativo diventa uno
-- sbilanciamento positivo nei grafici, vedi ChartsIncomeExpense) o enormi,
-- corrompendo statistiche e budget. Aggiungiamo CHECK constraint lato DB.
--
-- NOT VALID: il constraint è enforced su INSERT/UPDATE futuri ma NON valida
-- le righe storiche (evita failure della migration se ci sono anomalie
-- preesistenti). È lo standard PostgreSQL per aggiungere constraint a tabelle
-- popolate in modo sicuro.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  -- transactions: amount > 0 (importo 0 è privo di senso; negativo corrompe i grafici)
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_name = 'transactions' AND constraint_name = 'transactions_amount_positive') THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;

  -- recurring_expenses: amount > 0 (verrebbe usato per generare transazioni)
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_name = 'recurring_expenses' AND constraint_name = 'recurring_expenses_amount_positive') THEN
    ALTER TABLE public.recurring_expenses
      ADD CONSTRAINT recurring_expenses_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;

  -- budgets: amount >= 0
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_name = 'budgets' AND constraint_name = 'budgets_amount_nonneg') THEN
    ALTER TABLE public.budgets
      ADD CONSTRAINT budgets_amount_nonneg CHECK (amount >= 0) NOT VALID;
  END IF;

  -- savings_goals: target e current non negativi (0 è legittimo)
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_name = 'savings_goals' AND constraint_name = 'savings_goals_target_nonneg') THEN
    ALTER TABLE public.savings_goals
      ADD CONSTRAINT savings_goals_target_nonneg CHECK (target_amount >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_name = 'savings_goals' AND constraint_name = 'savings_goals_current_nonneg') THEN
    ALTER TABLE public.savings_goals
      ADD CONSTRAINT savings_goals_current_nonneg CHECK (current_amount >= 0) NOT VALID;
  END IF;

  -- portfolio_assets: quantity e purchase_price non negativi
  -- (quantity = 0 è legittimo per posizioni chiuse/liquidità)
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_name = 'portfolio_assets' AND constraint_name = 'portfolio_quantity_nonneg') THEN
    ALTER TABLE public.portfolio_assets
      ADD CONSTRAINT portfolio_quantity_nonneg CHECK (quantity >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_name = 'portfolio_assets' AND constraint_name = 'portfolio_purchase_price_nonneg') THEN
    ALTER TABLE public.portfolio_assets
      ADD CONSTRAINT portfolio_purchase_price_nonneg CHECK (purchase_price >= 0) NOT VALID;
  END IF;
END $$;
