-- QUICK START: Penalty Wallet System Migration
-- Run this entire script to set up the penalty wallet system
-- This combines all necessary migrations in the correct order

-- ============================================================================
-- STEP 1: CREATE ENUMS
-- ============================================================================

-- Drop enums if they exist (to avoid conflicts)
DROP TYPE IF EXISTS public.withdrawal_status CASCADE;
DROP TYPE IF EXISTS public.signatory_status CASCADE;

-- Create enums
CREATE TYPE public.withdrawal_status AS ENUM (
  'pending', 'submitted', 'approved', 'rejected', 'completed', 'cancelled'
);

CREATE TYPE public.signatory_status AS ENUM (
  'pending', 'approved', 'rejected'
);

-- ============================================================================
-- STEP 2: CREATE PENALTY WALLET TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.penalty_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_balance NUMERIC NOT NULL DEFAULT 0,
  total_received NUMERIC NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- STEP 3: CREATE PENALTY PAYMENT RECORDS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.penalty_payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  penalty_id UUID REFERENCES public.penalties(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  payment_ref TEXT,
  mpesa_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.penalty_payment_records ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: CREATE PENALTY WITHDRAWALS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.penalty_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  phone_number TEXT,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status public.withdrawal_status NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.penalty_withdrawals ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: CREATE WITHDRAWAL SIGNATORIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.withdrawal_signatories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id UUID NOT NULL REFERENCES public.penalty_withdrawals(id) ON DELETE CASCADE,
  signatory_role TEXT NOT NULL CHECK (signatory_role IN ('chairperson', 'secretary', 'treasurer')),
  signatory_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.signatory_status NOT NULL DEFAULT 'pending',
  signature_url TEXT,
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(withdrawal_id, signatory_role)
);

ALTER TABLE public.withdrawal_signatories ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: CREATE WITHDRAWAL RECEIPTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.withdrawal_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id UUID NOT NULL REFERENCES public.penalty_withdrawals(id) ON DELETE CASCADE,
  receipt_pdf_url TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_receipts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 7: CREATE B2C TRANSACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.b2c_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id UUID NOT NULL REFERENCES public.penalty_withdrawals(id) ON DELETE CASCADE,
  mpesa_transaction_id TEXT NOT NULL UNIQUE,
  phone_number TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'pending', 'completed', 'failed')),
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.b2c_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 8: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_penalty_payment_records_member_id ON public.penalty_payment_records(member_id);
CREATE INDEX IF NOT EXISTS idx_penalty_payment_records_status ON public.penalty_payment_records(status);
CREATE INDEX IF NOT EXISTS idx_penalty_withdrawals_status ON public.penalty_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_signatories_withdrawal_id ON public.withdrawal_signatories(withdrawal_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_signatories_signatory_user_id ON public.withdrawal_signatories(signatory_user_id);
CREATE INDEX IF NOT EXISTS idx_b2c_transactions_withdrawal_id ON public.b2c_transactions(withdrawal_id);
CREATE INDEX IF NOT EXISTS idx_b2c_transactions_mpesa_transaction_id ON public.b2c_transactions(mpesa_transaction_id);
CREATE INDEX IF NOT EXISTS idx_b2c_transactions_status ON public.b2c_transactions(status);

-- ============================================================================
-- STEP 9: CREATE TRIGGERS
-- ============================================================================

-- Function to update penalty wallet balance
CREATE OR REPLACE FUNCTION public.update_penalty_wallet_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
BEGIN
  IF NEW.status = 'verified' AND OLD.status != 'verified' THEN
    UPDATE penalty_wallet 
    SET 
      total_balance = total_balance + NEW.amount,
      total_received = total_received + NEW.amount,
      last_updated = now()
    WHERE id = (SELECT id FROM penalty_wallet LIMIT 1);
  END IF;
  RETURN NEW;
END;
$;

-- Trigger for penalty payment verification
CREATE TRIGGER IF NOT EXISTS penalty_payment_verified_trigger
AFTER UPDATE ON public.penalty_payment_records
FOR EACH ROW
EXECUTE FUNCTION public.update_penalty_wallet_balance();

-- Function to update wallet on withdrawal completion
CREATE OR REPLACE FUNCTION public.update_wallet_on_withdrawal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE penalty_wallet 
    SET 
      total_balance = total_balance - NEW.amount,
      total_withdrawn = total_withdrawn + NEW.amount,
      last_updated = now()
    WHERE id = (SELECT id FROM penalty_wallet LIMIT 1);
  END IF;
  RETURN NEW;
END;
$;

-- Trigger for withdrawal completion
CREATE TRIGGER IF NOT EXISTS withdrawal_completed_trigger
AFTER UPDATE ON public.penalty_withdrawals
FOR EACH ROW
EXECUTE FUNCTION public.update_wallet_on_withdrawal();

-- Function to update B2C transaction timestamps
CREATE OR REPLACE FUNCTION public.update_b2c_transaction_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = now();
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$;

-- Trigger for B2C transaction status updates
CREATE TRIGGER IF NOT EXISTS b2c_transaction_status_trigger
BEFORE UPDATE ON public.b2c_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_b2c_transaction_status();

-- ============================================================================
-- STEP 10: CREATE RLS POLICIES
-- ============================================================================

-- Penalty Payment Records Policies
CREATE POLICY IF NOT EXISTS "Members can view own penalty payments"
ON public.penalty_payment_records FOR SELECT
TO authenticated
USING (member_id = (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "Admin can view all penalty payments"
ON public.penalty_payment_records FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY IF NOT EXISTS "Admin can insert penalty payments"
ON public.penalty_payment_records FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY IF NOT EXISTS "Admin can update penalty payments"
ON public.penalty_payment_records FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Penalty Withdrawals Policies
CREATE POLICY IF NOT EXISTS "Admin can view withdrawals"
ON public.penalty_withdrawals FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY IF NOT EXISTS "Signatories can view withdrawals"
ON public.penalty_withdrawals FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.withdrawal_signatories ws
    WHERE ws.withdrawal_id = id AND ws.signatory_user_id = auth.uid()
  )
);

CREATE POLICY IF NOT EXISTS "Admin can create withdrawals"
ON public.penalty_withdrawals FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY IF NOT EXISTS "Admin can update own withdrawals"
ON public.penalty_withdrawals FOR UPDATE
TO authenticated
USING (requested_by = auth.uid());

-- Withdrawal Signatories Policies
CREATE POLICY IF NOT EXISTS "Signatories can view their assignments"
ON public.withdrawal_signatories FOR SELECT
TO authenticated
USING (signatory_user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Admin can view all signatories"
ON public.withdrawal_signatories FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY IF NOT EXISTS "Signatories can update their status"
ON public.withdrawal_signatories FOR UPDATE
TO authenticated
USING (signatory_user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Admin can insert withdrawal signatories"
ON public.withdrawal_signatories FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Withdrawal Receipts Policies
CREATE POLICY IF NOT EXISTS "Admin can view receipts"
ON public.withdrawal_receipts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY IF NOT EXISTS "Signatories can view receipts"
ON public.withdrawal_receipts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.withdrawal_signatories ws
    WHERE ws.withdrawal_id = withdrawal_id AND ws.signatory_user_id = auth.uid()
  )
);

-- B2C Transactions Policies
CREATE POLICY IF NOT EXISTS "Admin can view B2C transactions"
ON public.b2c_transactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY IF NOT EXISTS "Admin can insert B2C transactions"
ON public.b2c_transactions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY IF NOT EXISTS "Admin can update B2C transactions"
ON public.b2c_transactions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- ============================================================================
-- STEP 11: INITIALIZE PENALTY WALLET
-- ============================================================================

INSERT INTO public.penalty_wallet (id, total_balance, total_received, total_withdrawn, last_updated, created_at)
VALUES (gen_random_uuid(), 0, 0, 0, now(), now())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 12: VERIFICATION
-- ============================================================================

-- Verify all tables created
SELECT 
  'Setup Complete' as status,
  COUNT(*) as tables_created
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'penalty_wallet',
  'penalty_payment_records',
  'penalty_withdrawals',
  'withdrawal_signatories',
  'withdrawal_receipts',
  'b2c_transactions'
);

-- Verify wallet initialized
SELECT 
  'Wallet Initialized' as status,
  COUNT(*) as wallet_count
FROM public.penalty_wallet;

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================

-- All tables, triggers, indexes, and RLS policies have been created successfully!
-- You can now use the penalty wallet system.
