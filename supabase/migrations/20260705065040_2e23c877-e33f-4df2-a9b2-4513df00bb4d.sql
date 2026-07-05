CREATE TABLE IF NOT EXISTS public.role_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  badge_url TEXT,
  color TEXT DEFAULT '#16a34a',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_badges TO authenticated;
GRANT SELECT ON public.role_badges TO anon;
GRANT ALL ON public.role_badges TO service_role;

ALTER TABLE public.role_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view role badges"
  ON public.role_badges FOR SELECT
  USING (true);

CREATE POLICY "Admins manage role badges"
  ON public.role_badges FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_role_badges_updated_at
  BEFORE UPDATE ON public.role_badges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed labels/colours for the known executive roles (badge images added by admin later)
INSERT INTO public.role_badges (role, label, color) VALUES
  ('chairperson', 'Chairperson', '#b45309'),
  ('vice_chairperson', 'Vice Chairperson', '#b45309'),
  ('secretary', 'Secretary', '#1d4ed8'),
  ('vice_secretary', 'Vice Secretary', '#1d4ed8'),
  ('treasurer', 'Treasurer', '#047857'),
  ('patron', 'Patron', '#7c3aed'),
  ('executive', 'Executive', '#be123c')
ON CONFLICT (role) DO NOTHING;
