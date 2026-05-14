-- Update RLS policies to allow all members to view approved minutes

-- Drop the old policy
DROP POLICY IF EXISTS "Secretaries can view all minutes" ON meeting_minutes;

-- Allow office bearers to view all minutes
CREATE POLICY "Office bearers can view all minutes" ON meeting_minutes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('secretary', 'vice_secretary', 'admin', 'chairperson', 'vice_chairperson', 'patron')
    )
  );

-- Allow all authenticated members to view approved minutes
CREATE POLICY "Members can view approved minutes" ON meeting_minutes
  FOR SELECT
  TO authenticated
  USING (status = 'approved');
