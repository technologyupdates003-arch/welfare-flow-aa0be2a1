-- Penalty Wallet System
-- Stores penalty payments and withdrawal requests

-- Enum for withdrawal status
CREATE TYPE public.withdrawal_status AS ENUM ('pending', 'submitted', 'approved', 'rejected', 'completed', 'cancelled');

-- Enum for signatory status
CREATE TYPE public.signatory_status AS ENUM ('pending', 'approved', 'rejected');

-- Penalty Wallet Table
CREATE TABLE public.penalty_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_balance NUMERIC NOT NULL DEFAULT 0,
  total_received NUMERIC NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Penalty Payment Records (when member pays penalty)
CREATE TABLE public.penalty_payment_records (
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

-- Penalty Withdrawal Requests
CREATE TABLE public.penalty_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status withdrawal_status NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.penalty_withdrawals ENABLE ROW LEVEL SECURITY;

-- Withdrawal Signatories (tracks approval from chairperson, secretary, treasurer)
CREATE TABLE public.withdrawal_signatories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id UUID NOT NULL REFERENCES public.penalty_withdrawals(id) ON DELETE CASCADE,
  signatory_role TEXT NOT NULL CHECK (signatory_role IN ('chairperson', 'secretary', 'treasurer')),
  signatory_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status signatory_status NOT NULL DEFAULT 'pending',
  signature_url TEXT,
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(withdrawal_id, signatory_role)
);

ALTER TABLE public.penalty_withdrawals ENABLE ROW LEVEL SECURITY;

-- Withdrawal Receipt (PDF record with all signatures)
CREATE TABLE public.withdrawal_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id UUID NOT NULL REFERENCES public.penalty_withdrawals(id) ON DELETE CASCADE,
  receipt_pdf_url TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Penalty Wallet

-- Penalty Payment Records
CREATE POLICY "Members can view own penalty payments"
ON public.penalty_payment_records FOR SELECT
TO authenticated
USING (member_id = (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Admin can view all penalty payments"
ON public.penalty_payment_records FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admin can insert penalty payments"
ON public.penalty_payment_records FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admin can update penalty payments"
ON public.penalty_payment_records FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Penalty Withdrawals
CREATE POLICY "Admin can view withdrawals"
ON public.penalty_withdrawals FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Signatories can view withdrawals"
ON public.penalty_withdrawals FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.withdrawal_signatories ws
    WHERE ws.withdrawal_id = id AND ws.signatory_user_id = auth.uid()
  )
);

CREATE POLICY "Admin can create withdrawals"
ON public.penalty_withdrawals FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admin can update own withdrawals"
ON public.penalty_withdrawals FOR UPDATE
TO authenticated
USING (requested_by = auth.uid());

-- Withdrawal Signatories
CREATE POLICY "Signatories can view their assignments"
ON public.withdrawal_signatories FOR SELECT
TO authenticated
USING (signatory_user_id = auth.uid());

CREATE POLICY "Admin can view all signatories"
ON public.withdrawal_signatories FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Signatories can update their status"
ON public.withdrawal_signatories FOR UPDATE
TO authenticated
USING (signatory_user_id = auth.uid());

CREATE POLICY "Admin can insert withdrawal signatories"
ON public.withdrawal_signatories FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Withdrawal Receipts
CREATE POLICY "Admin can view receipts"
ON public.withdrawal_receipts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Signatories can view receipts"
ON public.withdrawal_receipts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.withdrawal_signatories ws
    WHERE ws.withdrawal_id = withdrawal_id AND ws.signatory_user_id = auth.uid()
  )
);

-- Initialize penalty wallet (single row)
INSERT INTO public.penalty_wallet (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- Function to update penalty wallet balance
CREATE OR REPLACE FUNCTION public.update_penalty_wallet_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Trigger for penalty payment verification
CREATE TRIGGER penalty_payment_verified_trigger
AFTER UPDATE ON public.penalty_payment_records
FOR EACH ROW
EXECUTE FUNCTION public.update_penalty_wallet_balance();

-- Function to update wallet on withdrawal completion
CREATE OR REPLACE FUNCTION public.update_wallet_on_withdrawal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Trigger for withdrawal completion
CREATE TRIGGER withdrawal_completed_trigger
AFTER UPDATE ON public.penalty_withdrawals
FOR EACH ROW
EXECUTE FUNCTION public.update_wallet_on_withdrawal();

-- Create indexes for performance
CREATE INDEX idx_penalty_payment_records_member_id ON public.penalty_payment_records(member_id);
CREATE INDEX idx_penalty_payment_records_status ON public.penalty_payment_records(status);
CREATE INDEX idx_penalty_withdrawals_status ON public.penalty_withdrawals(status);
CREATE INDEX idx_withdrawal_signatories_withdrawal_id ON public.withdrawal_signatories(withdrawal_id);
CREATE INDEX idx_withdrawal_signatories_signatory_user_id ON public.withdrawal_signatories(signatory_user_id);
