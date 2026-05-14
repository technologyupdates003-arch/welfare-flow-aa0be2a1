CREATE POLICY "Authenticated can view org settings"
ON public.organization_settings FOR SELECT
TO authenticated
USING (true);