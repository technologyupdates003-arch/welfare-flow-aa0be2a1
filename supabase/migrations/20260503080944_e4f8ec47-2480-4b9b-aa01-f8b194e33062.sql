
-- Create missing penalty_payments table
CREATE TABLE IF NOT EXISTS public.penalty_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  reference_number TEXT NOT NULL UNIQUE,
  payment_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_penalty_payments_member_id ON public.penalty_payments(member_id);
CREATE INDEX IF NOT EXISTS idx_penalty_payments_status ON public.penalty_payments(status);

ALTER TABLE public.penalty_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own penalty payments"
  ON public.penalty_payments FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Members insert own penalty payments"
  ON public.penalty_payments FOR INSERT TO authenticated
  WITH CHECK (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Admins view all penalty payments"
  ON public.penalty_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'treasurer')));

CREATE POLICY "Admins update penalty payments"
  ON public.penalty_payments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'treasurer')));

CREATE POLICY "Admins delete penalty payments"
  ON public.penalty_payments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')));

CREATE TRIGGER update_penalty_payments_updated_at
  BEFORE UPDATE ON public.penalty_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
