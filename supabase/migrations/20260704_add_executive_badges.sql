-- Create executive_badges table for admin-uploaded badges
CREATE TABLE IF NOT EXISTS public.executive_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL UNIQUE,
  badge_url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create bridge table to link members to executive roles with badges
CREATE TABLE IF NOT EXISTS public.member_executive_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  badge_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(member_id, role_name)
);

-- Enable RLS
ALTER TABLE public.executive_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_executive_roles ENABLE ROW LEVEL SECURITY;

-- Policies for executive_badges
-- Anyone can view badges
CREATE POLICY "Anyone can view executive badges"
  ON public.executive_badges FOR SELECT
  USING (true);

-- Only admins can insert/update/delete badges
CREATE POLICY "Only admins can manage executive badges"
  ON public.executive_badges FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'super_admin')
      AND ur.is_active = true
    )
  );

CREATE POLICY "Only admins can update executive badges"
  ON public.executive_badges FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'super_admin')
      AND ur.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'super_admin')
      AND ur.is_active = true
    )
  );

CREATE POLICY "Only admins can delete executive badges"
  ON public.executive_badges FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'super_admin')
      AND ur.is_active = true
    )
  );

-- Policies for member_executive_roles
-- Members can view their own roles and all active roles
CREATE POLICY "Members can view all active executive roles"
  ON public.member_executive_roles FOR SELECT
  USING (true);

-- Only admins can insert/update/delete member executive roles
CREATE POLICY "Only admins can manage member executive roles"
  ON public.member_executive_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'super_admin')
      AND ur.is_active = true
    )
  );

CREATE POLICY "Only admins can update member executive roles"
  ON public.member_executive_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'super_admin')
      AND ur.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'super_admin')
      AND ur.is_active = true
    )
  );

CREATE POLICY "Only admins can delete member executive roles"
  ON public.member_executive_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'super_admin')
      AND ur.is_active = true
    )
  );

-- Grant permissions
GRANT SELECT ON public.executive_badges TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.executive_badges TO authenticated;

GRANT SELECT ON public.member_executive_roles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.member_executive_roles TO authenticated;

-- Create triggers for updated_at
CREATE TRIGGER update_executive_badges_updated_at
  BEFORE UPDATE ON public.executive_badges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_member_executive_roles_updated_at
  BEFORE UPDATE ON public.member_executive_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
