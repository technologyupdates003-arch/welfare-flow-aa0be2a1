CREATE POLICY "Admins and office bearers can create signatories"
ON public.withdrawal_signatories
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'treasurer'::app_role)
  OR has_role(auth.uid(), 'chairperson'::app_role)
  OR has_role(auth.uid(), 'secretary'::app_role)
);