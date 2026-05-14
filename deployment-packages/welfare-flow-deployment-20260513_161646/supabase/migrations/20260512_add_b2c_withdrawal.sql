-- B2C Withdrawal Enhancement
-- Adds phone number to withdrawals and B2C transaction tracking

-- Add phone_number column to penalty_withdrawals if it doesn't exist
ALTER TABLE public.penalty_withdrawals
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Create B2C Transactions table for tracking M-Pesa transfers
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

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_b2c_transactions_withdrawal_id ON public.b2c_transactions(withdrawal_id);
CREATE INDEX IF NOT EXISTS idx_b2c_transactions_mpesa_transaction_id ON public.b2c_transactions(mpesa_transaction_id);
CREATE INDEX IF NOT EXISTS idx_b2c_transactions_status ON public.b2c_transactions(status);

-- RLS Policies for B2C Transactions
CREATE POLICY "Admin can view B2C transactions"
ON public.b2c_transactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admin can insert B2C transactions"
ON public.b2c_transactions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admin can update B2C transactions"
ON public.b2c_transactions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Function to update B2C transaction status
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
