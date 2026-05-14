-- Add all missing absence tracking columns to meeting_minutes table
ALTER TABLE meeting_minutes 
ADD COLUMN IF NOT EXISTS discussions TEXT,
ADD COLUMN IF NOT EXISTS absent_with_apology TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS absent_without_apology TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS chairperson_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS chairperson_signature_url TEXT,
ADD COLUMN IF NOT EXISTS secretary_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS secretary_signature_url TEXT,
ADD COLUMN IF NOT EXISTS visible_to_members TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Update RLS policies to allow office bearers to create minutes
DROP POLICY IF EXISTS "Secretaries can create minutes" ON meeting_minutes;
CREATE POLICY "Office bearers can create minutes" ON meeting_minutes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('secretary', 'vice_secretary', 'admin', 'chairperson', 'vice_chairperson', 'patron')
    )
  );

-- Update delete policy to allow office bearers
DROP POLICY IF EXISTS "Secretaries can delete minutes" ON meeting_minutes;
CREATE POLICY "Office bearers can delete minutes" ON meeting_minutes
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'secretary', 'vice_secretary', 'chairperson', 'vice_chairperson', 'patron')
    )
  );

-- Update update policy to allow office bearers
DROP POLICY IF EXISTS "Secretaries can update minutes" ON meeting_minutes;
CREATE POLICY "Office bearers can update minutes" ON meeting_minutes
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'secretary', 'vice_secretary', 'chairperson', 'vice_chairperson', 'patron')
    )
  );

-- View policy: Office bearers see all, members see approved or those they're in visible_to_members
DROP POLICY IF EXISTS "View meeting minutes" ON meeting_minutes;
CREATE POLICY "View meeting minutes" ON meeting_minutes
  FOR SELECT
  TO authenticated
  USING (
    status = 'approved' OR
    auth.uid() = ANY(visible_to_members) OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('secretary', 'vice_secretary', 'admin', 'chairperson', 'vice_chairperson', 'patron')
    )
  );
