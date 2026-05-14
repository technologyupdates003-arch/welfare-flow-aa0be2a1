-- Create office_bearer_signatures table for storing chairperson and secretary signatures
CREATE TABLE IF NOT EXISTS office_bearer_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(50) NOT NULL UNIQUE,
  signature_url TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE office_bearer_signatures ENABLE ROW LEVEL SECURITY;

-- Allow admins to view and update signatures
CREATE POLICY "Admins can view signatures" ON office_bearer_signatures
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update signatures" ON office_bearer_signatures
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert signatures" ON office_bearer_signatures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Allow office bearers to view their own signatures
CREATE POLICY "Office bearers can view signatures" ON office_bearer_signatures
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert default records for chairperson and secretary
INSERT INTO office_bearer_signatures (role, signature_url) 
VALUES 
  ('chairperson', NULL),
  ('secretary', NULL)
ON CONFLICT (role) DO NOTHING;
