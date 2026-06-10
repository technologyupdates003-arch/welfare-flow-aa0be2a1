-- ============================================================
-- Member Registration System tables
-- ============================================================

-- 1. registration_config (single active row of settings)
CREATE TABLE public.registration_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  retiring_date DATE,
  registration_fee NUMERIC NOT NULL DEFAULT 1000,
  active BOOLEAN NOT NULL DEFAULT true,
  show_on_login BOOLEAN NOT NULL DEFAULT true,
  auto_approve BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registration_config TO authenticated;
GRANT SELECT ON public.registration_config TO anon;
GRANT ALL ON public.registration_config TO service_role;
ALTER TABLE public.registration_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read registration config"
  ON public.registration_config FOR SELECT
  USING (true);
CREATE POLICY "Admins manage registration config"
  ON public.registration_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 2. member_registrations
CREATE TABLE public.member_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  department TEXT,
  working_location TEXT,
  date_of_birth DATE,
  status TEXT NOT NULL DEFAULT 'payment_pending',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  approval_notes TEXT,
  rejection_reason TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_registrations TO authenticated;
GRANT ALL ON public.member_registrations TO service_role;
ALTER TABLE public.member_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage member registrations"
  ON public.member_registrations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 3. registration_fees
CREATE TABLE public.registration_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_id UUID NOT NULL REFERENCES public.member_registrations(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  phone_number TEXT,
  mpesa_checkout_request_id TEXT,
  mpesa_transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  last_retry_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registration_fees TO authenticated;
GRANT ALL ON public.registration_fees TO service_role;
ALTER TABLE public.registration_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage registration fees"
  ON public.registration_fees FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 4. registration_access_links
CREATE TABLE public.registration_access_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_id UUID NOT NULL REFERENCES public.member_registrations(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL UNIQUE,
  temporary_password TEXT,
  used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registration_access_links TO authenticated;
GRANT ALL ON public.registration_access_links TO service_role;
ALTER TABLE public.registration_access_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage registration access links"
  ON public.registration_access_links FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- updated_at triggers
CREATE TRIGGER update_registration_config_updated_at
  BEFORE UPDATE ON public.registration_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_member_registrations_updated_at
  BEFORE UPDATE ON public.member_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_registration_fees_updated_at
  BEFORE UPDATE ON public.registration_fees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- seed one config row
INSERT INTO public.registration_config (retiring_date, registration_fee, active, show_on_login, auto_approve)
VALUES ('2027-12-31', 1000, true, true, false);