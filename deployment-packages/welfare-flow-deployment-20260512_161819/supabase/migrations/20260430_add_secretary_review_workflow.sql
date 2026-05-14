-- Add secretary review step to meeting minutes workflow
-- Workflow: Vice Secretary (draft) -> Secretary (review) -> Chairperson (approve)

-- Add secretary review fields
ALTER TABLE meeting_minutes 
ADD COLUMN IF NOT EXISTS secretary_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE meeting_minutes 
ADD COLUMN IF NOT EXISTS secretary_reviewed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE meeting_minutes 
ADD COLUMN IF NOT EXISTS secretary_notes TEXT;

-- Update status workflow to include secretary review
-- Status values: 
-- 'draft' - Vice Secretary writing
-- 'submitted_to_secretary' - Vice Secretary submitted to Secretary
-- 'secretary_reviewed' - Secretary reviewed and forwarded to Chairperson  
-- 'submitted_for_approval' - Submitted to Chairperson for final approval
-- 'approved' - Chairperson approved
-- 'rejected_by_secretary' - Secretary rejected, back to Vice Secretary
-- 'rejected_by_chairperson' - Chairperson rejected, back to Secretary

-- Update RLS policies for the new workflow

-- Allow vice secretaries to create and update their own draft minutes
DROP POLICY IF EXISTS "Vice secretaries can manage draft minutes" ON meeting_minutes;
CREATE POLICY "Vice secretaries can manage draft minutes" ON meeting_minutes
  FOR ALL
  TO authenticated
  USING (
    (created_by = auth.uid() AND status IN ('draft', 'rejected_by_secretary', 'rejected_by_chairperson')) OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('vice_secretary', 'admin')
    )
  )
  WITH CHECK (
    (created_by = auth.uid() AND status IN ('draft', 'submitted_to_secretary')) OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('vice_secretary', 'admin')
    )
  );

-- Allow secretaries to view and review minutes submitted to them
DROP POLICY IF EXISTS "Secretaries can review submitted minutes" ON meeting_minutes;
CREATE POLICY "Secretaries can review submitted minutes" ON meeting_minutes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('secretary', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('secretary', 'admin')
    )
  );

-- Allow chairpersons to view and approve minutes submitted by secretary
DROP POLICY IF EXISTS "Chairpersons can approve minutes" ON meeting_minutes;
CREATE POLICY "Chairpersons can approve minutes" ON meeting_minutes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('chairperson', 'vice_chairperson', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('chairperson', 'vice_chairperson', 'admin')
    )
  );

-- Create indexes for the new workflow fields
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_secretary_review ON meeting_minutes(secretary_reviewed_by, secretary_reviewed_at);
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_workflow_status ON meeting_minutes(status, created_by);

-- Create a function to get minutes pending review for each role
CREATE OR REPLACE FUNCTION get_minutes_pending_review(user_role TEXT)
RETURNS TABLE (
  id UUID,
  title VARCHAR(255),
  meeting_date DATE,
  status VARCHAR(50),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF user_role = 'secretary' THEN
    RETURN QUERY
    SELECT m.id, m.title, m.meeting_date, m.status, m.created_by, m.created_at, m.submitted_at
    FROM meeting_minutes m
    WHERE m.status = 'submitted_to_secretary'
    ORDER BY m.submitted_at ASC;
  ELSIF user_role = 'chairperson' THEN
    RETURN QUERY
    SELECT m.id, m.title, m.meeting_date, m.status, m.created_by, m.created_at, m.submitted_at
    FROM meeting_minutes m
    WHERE m.status = 'secretary_reviewed'
    ORDER BY m.secretary_reviewed_at ASC;
  END IF;
END;
$$;