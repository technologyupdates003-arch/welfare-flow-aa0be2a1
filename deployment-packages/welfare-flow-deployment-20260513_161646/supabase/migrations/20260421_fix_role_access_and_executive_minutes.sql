-- Update meeting_minutes table to track executive attendees separately
ALTER TABLE meeting_minutes 
ADD COLUMN IF NOT EXISTS executive_attendees TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS executive_absent_with_apology TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS executive_absent_without_apology TEXT[] DEFAULT '{}';

-- Update RLS policies for meeting_minutes to restrict executive minutes visibility
-- Drop existing policies first
DROP POLICY IF NOT EXISTS "Members can view approved general minutes" ON meeting_minutes;
DROP POLICY IF NOT EXISTS "Members can view approved executive minutes" ON meeting_minutes;
DROP POLICY IF NOT EXISTS "Secretary can view own minutes" ON meeting_minutes;
DROP POLICY IF NOT EXISTS "Chairperson can view submitted minutes" ON meeting_minutes;
DROP POLICY IF NOT EXISTS "Admins can view all minutes" ON meeting_minutes;

-- New RLS Policies for meeting_minutes
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

-- Members with roles can view approved executive minutes if they have a role
CREATE POLICY "Members with roles can view executive minutes"
  ON meeting_minutes FOR SELECT
  USING (
    status = 'approved' AND 
    meeting_type = 'executive' AND
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid()
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
    )
  );

-- Update user_roles table to add soft delete capability
ALTER TABLE user_roles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP;

-- Create index for active roles
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(user_id, is_active);

-- Update RLS policies for user_roles to respect is_active flag
DROP POLICY IF NOT EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF NOT EXISTS "Admins can view all roles" ON user_roles;

CREATE POLICY "Users can view their active roles"
  ON user_roles FOR SELECT
  USING (
    (user_id = auth.uid() AND is_active = true) OR
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'super_admin')
      AND ur.is_active = true
    )
  );

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
