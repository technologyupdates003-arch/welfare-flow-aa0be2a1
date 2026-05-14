-- Open SELECT for completed withdrawals to all authenticated users so members can view receipts
DROP POLICY IF EXISTS "Members can view completed penalty withdrawals" ON public.penalty_withdrawals;
CREATE POLICY "Members can view completed penalty withdrawals"
ON public.penalty_withdrawals FOR SELECT
TO authenticated
USING (status = 'completed');

DROP POLICY IF EXISTS "Members can view completed donation withdrawals" ON public.donation_withdrawals;
CREATE POLICY "Members can view completed donation withdrawals"
ON public.donation_withdrawals FOR SELECT
TO authenticated
USING (status = 'completed');

-- Allow all authenticated users to view signatory rows (needed to render receipts)
DROP POLICY IF EXISTS "All authenticated can view withdrawal signatories" ON public.withdrawal_signatories;
CREATE POLICY "All authenticated can view withdrawal signatories"
ON public.withdrawal_signatories FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "All authenticated can view donation withdrawal signatories" ON public.donation_withdrawal_signatories;
CREATE POLICY "All authenticated can view donation withdrawal signatories"
ON public.donation_withdrawal_signatories FOR SELECT
TO authenticated
USING (true);

-- Allow all authenticated users to view signatory signatures (so receipts can show name + signature)
DROP POLICY IF EXISTS "All authenticated can view signatory signatures" ON public.signatory_signatures;
CREATE POLICY "All authenticated can view signatory signatures"
ON public.signatory_signatures FOR SELECT
TO authenticated
USING (true);
