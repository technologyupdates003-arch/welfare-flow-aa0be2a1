-- Create meeting_minutes table
CREATE TABLE IF NOT EXISTS meeting_minutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL,
  meeting_type VARCHAR(50) DEFAULT 'general',
  title VARCHAR(255) NOT NULL,
  attendees TEXT[] DEFAULT ARRAY[]::TEXT[],
  agenda TEXT,
  discussions TEXT,
  decisions TEXT,
  action_items TEXT,
  next_meeting_date DATE,
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_created_by ON meeting_minutes(created_by);
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_meeting_date ON meeting_minutes(meeting_date);
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_status ON meeting_minutes(status);

-- Enable RLS
ALTER TABLE meeting_minutes ENABLE ROW LEVEL SECURITY;

-- Allow secretaries and admins to view all minutes
DROP POLICY IF EXISTS "Secretaries can view all minutes" ON meeting_minutes;
CREATE POLICY "Secretaries can view all minutes" ON meeting_minutes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('secretary', 'vice_secretary', 'admin', 'chairperson', 'vice_chairperson', 'patron')
    )
  );

-- Allow secretaries to create minutes
DROP POLICY IF EXISTS "Secretaries can create minutes" ON meeting_minutes;
CREATE POLICY "Secretaries can create minutes" ON meeting_minutes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('secretary', 'admin')
    )
  );

-- Allow secretaries to update their own minutes
DROP POLICY IF EXISTS "Secretaries can update minutes" ON meeting_minutes;
CREATE POLICY "Secretaries can update minutes" ON meeting_minutes
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Allow secretaries to delete their own minutes
DROP POLICY IF EXISTS "Secretaries can delete minutes" ON meeting_minutes;
CREATE POLICY "Secretaries can delete minutes" ON meeting_minutes
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );