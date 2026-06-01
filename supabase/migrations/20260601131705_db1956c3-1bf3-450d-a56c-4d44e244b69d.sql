CREATE TABLE public.dashboard_security (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  pin_hash text,
  webauthn_credential_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_security TO authenticated;
GRANT ALL ON public.dashboard_security TO service_role;

ALTER TABLE public.dashboard_security ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dashboard security"
ON public.dashboard_security
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dashboard security"
ON public.dashboard_security
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dashboard security"
ON public.dashboard_security
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dashboard security"
ON public.dashboard_security
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_dashboard_security_updated_at
BEFORE UPDATE ON public.dashboard_security
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();