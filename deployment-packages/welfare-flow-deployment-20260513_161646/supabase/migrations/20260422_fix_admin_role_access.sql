-- Fix RLS policies to allow admins to access their dashboards
-- Drop the restrictive policies
DROP POLICY IF EXISTS "Users can view their active roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON user_roles;

-- Create new, less restrictive policies
-- Users can view their own active roles
CREATE POLICY "Users can view their own active roles"
  ON user_roles FOR SELECT
  USING (user_id = auth.uid() AND is_active = true);

-- Admins can view all roles (active or inactive)
CREATE POLICY "Admins can view all roles"
  ON user_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );

-- Admins can insert roles
CREATE POLICY "Admins can insert roles"
  ON user_roles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );

-- Admins can update roles
CREATE POLICY "Admins can update roles"
  ON user_roles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );

-- Admins can delete roles
CREATE POLICY "Admins can delete roles"
  ON user_roles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );

-- Fix meeting_minutes policies to allow admins full access
DROP POLICY IF EXISTS "Secretary can view own minutes" ON meeting_minutes;
DROP POLICY IF EXISTS "Secretary can insert minutes" ON meeting_minutes;
DROP POLICY IF EXISTS "Secretary can update own minutes" ON meeting_minutes;
DROP POLICY IF EXISTS "Secretary can delete own minutes" ON meeting_minutes;
DROP POLICY IF EXISTS "Chairperson can view minutes for approval" ON meeting_minutes;
DROP POLICY IF EXISTS "Chairperson can update minutes" ON meeting_minutes;
DROP POLICY IF EXISTS "Members can view approved general minutes" ON meeting_minutes;
DROP POLICY IF EXISTS "Members with roles can view executive minutes" ON meeting_minutes;
DROP POLICY IF EXISTS "Admins can view all minutes" ON meeting_minutes;
DROP POLICY IF EXISTS "Admins can update all minutes" ON meeting_minutes;
DROP POLICY IF EXISTS "Admins can delete all minutes" ON meeting_minutes;

-- Secretary can view and manage their own minutes
CREATE POLICY "Secretary can view own minutes"
  ON meeting_minutes FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Secretary can insert minutes"
  ON meeting_minutes FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Secretary can update own minutes"
  ON meeting_minutes FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Secretary can delete own minutes"
  ON meeting_minutes FOR DELETE
  USING (created_by = auth.uid());

-- Chairperson can view submitted/draft minutes for approval
CREATE POLICY "Chairperson can view minutes for approval"
  ON meeting_minutes FOR SELECT
  USING (
    status IN ('submitted', 'draft') AND
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'chairperson'
      AND is_active = true
    )
  );

-- Chairperson can update minutes (approve/reject)
CREATE POLICY "Chairperson can update minutes"
  ON meeting_minutes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'chairperson'
      AND is_active = true
    )
  );

-- Members can view approved general meeting minutes
CREATE POLICY "Members can view approved general minutes"
  ON meeting_minutes FOR SELECT
  USING (
    status = 'approved' AND 
    meeting_type != 'executive' AND
    EXISTS (
      SELECT 1 FROM members 
      WHERE user_id = auth.uid()
    )
  );

-- Members with active roles can view approved executive minutes
CREATE POLICY "Members with roles can view executive minutes"
  ON meeting_minutes FOR SELECT
  USING (
    status = 'approved' AND 
    meeting_type = 'executive' AND
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid()
      AND is_active = true
    )
  );

-- Admins can view all minutes
CREATE POLICY "Admins can view all minutes"
  ON meeting_minutes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );

-- Admins can update all minutes
CREATE POLICY "Admins can update all minutes"
  ON meeting_minutes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );

-- Admins can delete all minutes
CREATE POLICY "Admins can delete all minutes"
  ON meeting_minutes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );
