-- Remove the redundant table created earlier in this session
DROP TABLE IF EXISTS public.role_badges CASCADE;

-- Executive badges (uploaded/managed by admins)
CREATE TABLE IF NOT EXISTS public.executive_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_name TEXT NOT NULL UNIQUE,
  badge_url TEXT,
  description TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.executive_badges TO authenticated;
GRANT SELECT ON public.executive_badges TO anon;
GRANT ALL ON public.executive_badges TO service_role;

ALTER TABLE public.executive_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view executive badges"
  ON public.executive_badges FOR SELECT
  USING (true);

CREATE POLICY "Admins manage executive badges"
  ON public.executive_badges FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_executive_badges_updated_at
  BEFORE UPDATE ON public.executive_badges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Live view of members who hold executive roles (derived from user_roles).
-- Read-only; automatically reflects role assignments.
CREATE OR REPLACE VIEW public.member_executive_roles
WITH (security_invoker = true) AS
SELECT
  ur.id                AS id,
  m.id                 AS member_id,
  ur.role::text        AS role_name,
  m.is_active          AS is_active,
  m.name               AS member_name,
  ur.user_id           AS user_id
FROM public.user_roles ur
JOIN public.members m ON m.user_id = ur.user_id
WHERE ur.role::text IN (
  'chairperson','vice_chairperson','secretary','vice_secretary','treasurer','patron','executive'
);

GRANT SELECT ON public.member_executive_roles TO authenticated;
GRANT SELECT ON public.member_executive_roles TO anon;
GRANT SELECT ON public.member_executive_roles TO service_role;
