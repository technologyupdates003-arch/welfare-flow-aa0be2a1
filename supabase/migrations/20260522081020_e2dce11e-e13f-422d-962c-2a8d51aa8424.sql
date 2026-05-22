
-- ============================================================================
-- PHASE 1: Operational Wallet + Unified Ledger
-- ============================================================================

-- 1. OPERATIONAL WALLET (single-row balance, mirrors donation_wallet) -----------
CREATE TABLE IF NOT EXISTS public.operational_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_received NUMERIC NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC NOT NULL DEFAULT 0,
  total_balance NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.operational_wallet (total_received, total_withdrawn, total_balance)
SELECT 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM public.operational_wallet);

ALTER TABLE public.operational_wallet ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Office bearers can view operational wallet"
  ON public.operational_wallet FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','super_admin','chairperson','secretary','treasurer')));

CREATE POLICY "Admins can update operational wallet"
  ON public.operational_wallet FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','super_admin','treasurer')));

-- 2. OPERATIONAL PAYMENT RECORDS (C2B, top-ups) ---------------------------------
CREATE TABLE IF NOT EXISTS public.operational_payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID,
  amount NUMERIC NOT NULL,
  source TEXT NOT NULL DEFAULT 'stk_push', -- stk_push | manual_topup | bank_transfer | cash
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | verified | failed
  mpesa_transaction_id TEXT,
  payment_ref TEXT,
  notes TEXT,
  created_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.operational_payment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Treasury can view operational payments"
  ON public.operational_payment_records FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','super_admin','chairperson','secretary','treasurer')));

CREATE POLICY "Treasury can insert operational payments"
  ON public.operational_payment_records FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','super_admin','treasurer')));

CREATE POLICY "Treasury can update operational payments"
  ON public.operational_payment_records FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','super_admin','treasurer')));

-- 3. OPERATIONAL WITHDRAWALS (payouts + B2C expenses) ---------------------------
CREATE TABLE IF NOT EXISTS public.operational_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'payout', -- payout | expense | transfer
  expense_type TEXT,
  recipient_name TEXT,
  phone_number TEXT,
  requested_by UUID,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | completed | rejected
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.operational_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Office bearers view operational withdrawals"
  ON public.operational_withdrawals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','super_admin','chairperson','secretary','treasurer')));

CREATE POLICY "Treasury insert operational withdrawals"
  ON public.operational_withdrawals FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','super_admin','treasurer')));

CREATE POLICY "Office bearers update operational withdrawals"
  ON public.operational_withdrawals FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','super_admin','chairperson','secretary','treasurer')));

-- 4. OPERATIONAL WITHDRAWAL SIGNATORIES (mirrors donation_withdrawal_signatories)
CREATE TABLE IF NOT EXISTS public.operational_withdrawal_signatories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id UUID REFERENCES public.operational_withdrawals(id) ON DELETE CASCADE,
  signatory_role TEXT NOT NULL,
  signatory_user_id UUID,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  signature_url TEXT,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.operational_withdrawal_signatories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated view operational signatories"
  ON public.operational_withdrawal_signatories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Treasury insert operational signatories"
  ON public.operational_withdrawal_signatories FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','super_admin','treasurer')));

CREATE POLICY "Signatories update operational approvals"
  ON public.operational_withdrawal_signatories FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')
    OR (signatory_role = 'chairperson' AND public.has_role(auth.uid(),'chairperson'))
    OR (signatory_role = 'secretary'   AND public.has_role(auth.uid(),'secretary'))
    OR (signatory_role = 'treasurer'   AND public.has_role(auth.uid(),'treasurer'))
    OR signatory_user_id = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')
    OR (signatory_role = 'chairperson' AND public.has_role(auth.uid(),'chairperson'))
    OR (signatory_role = 'secretary'   AND public.has_role(auth.uid(),'secretary'))
    OR (signatory_role = 'treasurer'   AND public.has_role(auth.uid(),'treasurer'))
    OR signatory_user_id = auth.uid()
  );

-- 5. UNIFIED WALLET TRANSACTION LEDGER -----------------------------------------
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_type TEXT NOT NULL CHECK (wallet_type IN ('penalty','donation','operational')),
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  source TEXT NOT NULL, -- c2b | b2c | stk_push | topup | expense | transfer | manual
  reference_id UUID,
  reference_table TEXT,
  party_name TEXT,
  party_phone TEXT,
  gross_amount NUMERIC NOT NULL DEFAULT 0,
  mpesa_charge NUMERIC NOT NULL DEFAULT 0,
  system_fee NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  running_balance NUMERIC NOT NULL DEFAULT 0,
  mpesa_receipt TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_by UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet_time
  ON public.wallet_transactions (wallet_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_ref
  ON public.wallet_transactions (reference_table, reference_id);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Office bearers view wallet ledger"
  ON public.wallet_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','super_admin','chairperson','secretary','treasurer')));

CREATE POLICY "Treasury insert wallet ledger"
  ON public.wallet_transactions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','super_admin','treasurer')));

-- Trigger: auto-compute running_balance on insert
CREATE OR REPLACE FUNCTION public.set_wallet_tx_running_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_balance NUMERIC := 0;
BEGIN
  IF NEW.net_amount IS NULL OR NEW.net_amount = 0 THEN
    NEW.net_amount := CASE WHEN NEW.direction = 'in'
      THEN NEW.gross_amount - COALESCE(NEW.mpesa_charge,0) - COALESCE(NEW.system_fee,0)
      ELSE NEW.gross_amount + COALESCE(NEW.mpesa_charge,0) + COALESCE(NEW.system_fee,0)
    END;
  END IF;

  SELECT running_balance INTO prev_balance
    FROM public.wallet_transactions
   WHERE wallet_type = NEW.wallet_type
   ORDER BY occurred_at DESC, created_at DESC
   LIMIT 1;
  prev_balance := COALESCE(prev_balance, 0);

  NEW.running_balance := CASE
    WHEN NEW.direction = 'in'  THEN prev_balance + NEW.net_amount
    ELSE                            prev_balance - NEW.net_amount
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wallet_tx_running_balance ON public.wallet_transactions;
CREATE TRIGGER trg_wallet_tx_running_balance
  BEFORE INSERT ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_wallet_tx_running_balance();

-- 6. EXTEND b2c_transactions with Safaricom charge tracking --------------------
ALTER TABLE public.b2c_transactions
  ADD COLUMN IF NOT EXISTS mpesa_charge NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS working_account_balance NUMERIC,
  ADD COLUMN IF NOT EXISTS utility_account_balance NUMERIC,
  ADD COLUMN IF NOT EXISTS recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS wallet_type TEXT NOT NULL DEFAULT 'penalty',
  ADD COLUMN IF NOT EXISTS transaction_completed_at TIMESTAMPTZ;

-- 7. EXTEND expenses for unified payout engine ---------------------------------
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS wallet_type TEXT NOT NULL DEFAULT 'operational',
  ADD COLUMN IF NOT EXISTS withdrawal_id UUID,
  ADD COLUMN IF NOT EXISTS withdrawal_table TEXT,
  ADD COLUMN IF NOT EXISTS mpesa_charge NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- 8. Realtime publication ------------------------------------------------------
ALTER TABLE public.operational_wallet REPLICA IDENTITY FULL;
ALTER TABLE public.operational_payment_records REPLICA IDENTITY FULL;
ALTER TABLE public.operational_withdrawals REPLICA IDENTITY FULL;
ALTER TABLE public.operational_withdrawal_signatories REPLICA IDENTITY FULL;
ALTER TABLE public.wallet_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.b2c_transactions REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.operational_wallet; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.operational_payment_records; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.operational_withdrawals; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.operational_withdrawal_signatories; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.b2c_transactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 9. updated_at triggers
DROP TRIGGER IF EXISTS trg_op_wallet_upd ON public.operational_wallet;
CREATE TRIGGER trg_op_wallet_upd BEFORE UPDATE ON public.operational_wallet
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_op_pay_upd ON public.operational_payment_records;
CREATE TRIGGER trg_op_pay_upd BEFORE UPDATE ON public.operational_payment_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_op_wd_upd ON public.operational_withdrawals;
CREATE TRIGGER trg_op_wd_upd BEFORE UPDATE ON public.operational_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_op_sig_upd ON public.operational_withdrawal_signatories;
CREATE TRIGGER trg_op_sig_upd BEFORE UPDATE ON public.operational_withdrawal_signatories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
