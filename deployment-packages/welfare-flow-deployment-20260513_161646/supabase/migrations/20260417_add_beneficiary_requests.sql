-- Create beneficiary_requests table for member requests
CREATE TABLE IF NOT EXISTS beneficiary_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('add', 'remove')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- For add requests
  beneficiary_name VARCHAR(255),
  beneficiary_relationship VARCHAR(50),
  beneficiary_phone VARCHAR(20),
  beneficiary_id_number VARCHAR(50),
  
  -- For remove requests
  beneficiary_id UUID REFERENCES beneficiaries(id) ON DELETE SET NULL,
  
  -- Common fields
  reason TEXT NOT NULL,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_beneficiary_requests_member_id ON beneficiary_requests(member_id);
CREATE INDEX IF NOT EXISTS idx_beneficiary_requests_status ON beneficiary_requests(status);
CREATE INDEX IF NOT EXISTS idx_beneficiary_requests_type ON beneficiary_requests(request_type);

-- Enable RLS
ALTER TABLE beneficiary_requests ENABLE ROW LEVEL SECURITY;

-- Members can view their own requests
CREATE POLICY "Members can view own requests" ON beneficiary_requests
  FOR SELECT
  TO authenticated
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- Members can create requests
CREATE POLICY "Members can create requests" ON beneficiary_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- Admins can view all requests
CREATE POLICY "Admins can view all requests" ON beneficiary_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Admins can update requests
CREATE POLICY "Admins can update requests" ON beneficiary_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Admins can delete requests
CREATE POLICY "Admins can delete requests" ON beneficiary_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );
