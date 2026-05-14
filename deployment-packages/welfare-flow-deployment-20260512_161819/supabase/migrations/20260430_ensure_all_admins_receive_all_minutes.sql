-- Ensure all admins (admin and super_admin) receive all minutes
-- This migration reinforces the RLS policy to guarantee all admins see all minutes

-- Drop existing admin policies to recreate them more explicitly
DROP POLICY IF EXISTS "Admins can view all minutes" ON meeting_minutes;
DROP POLICY IF EXISTS "Admins can update all minutes" ON meeting_minutes;
DROP POLICY IF EXISTS "Admins can delete all minutes" ON meeting_minutes;

-- Recreate admin policies with explicit role checking
-- All admins (admin and super_admin) can view ALL minutes regardless of type or status
CREATE POLICY "All admins can view all minutes"
  ON meeting_minutes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );

-- All admins can update all minutes
CREATE POLICY "All admins can update all minutes"
  ON meeting_minutes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );

-- All admins can delete all minutes
CREATE POLICY "All admins can delete all minutes"
  ON meeting_minutes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );

-- All admins can insert minutes
CREATE POLICY "All admins can insert minutes"
  ON meeting_minutes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
      AND is_active = true
    )
  );

-- Verify that admin and super_admin roles exist in the system
-- This ensures the role enum includes these values
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Create a function to verify admin access to minutes
CREATE OR REPLACE FUNCTION check_admin_access_to_minutes()
RETURNS TABLE (
  user_id UUID,
  role user_role,
  can_view_all_minutes BOOLEAN,
  is_active BOOLEAN
) AS $$
  SELECT 
    ur.user_id,
    ur.role,
    (ur.role IN ('admin', 'super_admin')) as can_view_all_minutes,
    ur.is_active
  FROM user_roles ur
  WHERE ur.role IN ('admin', 'super_admin')
  ORDER BY ur.user_id;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_admin_access_to_minutes() TO authenticated;

-- Add comment to explain the policy
COMMENT ON POLICY "All admins can view all minutes" ON meeting_minutes IS 
'All users with admin or super_admin role can view all meeting minutes regardless of meeting type or approval status';

COMMENT ON POLICY "All admins can update all minutes" ON meeting_minutes IS 
'All users with admin or super_admin role can update all meeting minutes';

COMMENT ON POLICY "All admins can delete all minutes" ON meeting_minutes IS 
'All users with admin or super_admin role can delete all meeting minutes';

COMMENT ON POLICY "All admins can insert minutes" ON meeting_minutes IS 
'All users with admin or super_admin role can create new meeting minutes';
