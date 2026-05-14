
-- Penalty withdrawal signatories: allow office bearer with matching role
DROP POLICY IF EXISTS "Office bearers can update matching role signatory" ON public.withdrawal_signatories;
CREATE POLICY "Office bearers can update matching role signatory"
ON public.withdrawal_signatories
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (signatory_role = 'chairperson' AND public.has_role(auth.uid(), 'chairperson'::app_role))
  OR (signatory_role = 'secretary'   AND public.has_role(auth.uid(), 'secretary'::app_role))
  OR (signatory_role = 'treasurer'   AND public.has_role(auth.uid(), 'treasurer'::app_role))
  OR signatory_user_id = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (signatory_role = 'chairperson' AND public.has_role(auth.uid(), 'chairperson'::app_role))
  OR (signatory_role = 'secretary'   AND public.has_role(auth.uid(), 'secretary'::app_role))
  OR (signatory_role = 'treasurer'   AND public.has_role(auth.uid(), 'treasurer'::app_role))
  OR signatory_user_id = auth.uid()
);

-- Donation withdrawal signatories: same
DROP POLICY IF EXISTS "Office bearers can update matching role donation signatory" ON public.donation_withdrawal_signatories;
CREATE POLICY "Office bearers can update matching role donation signatory"
ON public.donation_withdrawal_signatories
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (signatory_role = 'chairperson' AND public.has_role(auth.uid(), 'chairperson'::app_role))
  OR (signatory_role = 'secretary'   AND public.has_role(auth.uid(), 'secretary'::app_role))
  OR (signatory_role = 'treasurer'   AND public.has_role(auth.uid(), 'treasurer'::app_role))
  OR signatory_user_id = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (signatory_role = 'chairperson' AND public.has_role(auth.uid(), 'chairperson'::app_role))
  OR (signatory_role = 'secretary'   AND public.has_role(auth.uid(), 'secretary'::app_role))
  OR (signatory_role = 'treasurer'   AND public.has_role(auth.uid(), 'treasurer'::app_role))
  OR signatory_user_id = auth.uid()
);
