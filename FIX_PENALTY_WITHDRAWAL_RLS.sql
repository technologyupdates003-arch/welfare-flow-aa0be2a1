-- Add missing RLS policies for penalty_withdrawals and withdrawal_signatories
-- This allows secretaries, chairpersons, and treasurers to view and approve penalty withdrawals

-- Enable RLS if not already enabled
ALTER TABLE public.penalty_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_signatories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view penalty withdrawals" ON public.penalty_withdrawals;
DROP POLICY IF EXISTS "Admins can insert penalty withdrawals" ON public.penalty_withdrawals;
DROP POLICY IF EXISTS "Admins can update penalty withdrawals" ON public.penalty_withdrawals;
DROP POLICY IF EXISTS "Signatories can view their withdrawal approvals" ON public.withdrawal_signatories;
DROP POLICY IF EXISTS "Signatories can update their approvals" ON public.withdrawal_signatories;
DROP POLICY IF EXISTS "Admins can insert withdrawal signatories" ON public.withdrawal_signatories;

-- RLS Policies for penalty_withdrawals
CREATE POLICY "Admins can view penalty withdrawals" ON public.penalty_withdrawals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'chairperson', 'secretary', 'treasurer')
    )
  );

CREATE POLICY "Admins can insert penalty withdrawals" ON public.penalty_withdrawals
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update penalty withdrawals" ON public.penalty_withdrawals
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'chairperson', 'secretary', 'treasurer')
    )
  );

-- RLS Policies for withdrawal_signatories
CREATE POLICY "Signatories can view their withdrawal approvals" ON public.withdrawal_signatories
  FOR SELECT USING (
    signatory_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'chairperson', 'secretary', 'treasurer')
    )
  );

CREATE POLICY "Signatories can update their approvals" ON public.withdrawal_signatories
  FOR UPDATE USING (
    signatory_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can insert withdrawal signatories" ON public.withdrawal_signatories
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Verify policies are in place
SELECT 'RLS policies for penalty withdrawals updated successfully' as status;
