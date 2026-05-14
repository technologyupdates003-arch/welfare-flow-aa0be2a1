-- Create penalty_payments table
CREATE TABLE IF NOT EXISTS penalty_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  reference_number VARCHAR(255) NOT NULL UNIQUE,
  payment_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_penalty_payments_member_id ON penalty_payments(member_id);
CREATE INDEX idx_penalty_payments_status ON penalty_payments(status);
CREATE INDEX idx_penalty_payments_reference ON penalty_payments(reference_number);

-- Enable RLS
ALTER TABLE penalty_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Members can view their own penalty payments
CREATE POLICY "Members can view own penalty payments"
  ON penalty_payments FOR SELECT
  USING (member_id = (SELECT id FROM members WHERE user_id = auth.uid()));

-- Members can insert their own penalty payments
CREATE POLICY "Members can insert own penalty payments"
  ON penalty_payments FOR INSERT
  WITH CHECK (member_id = (SELECT id FROM members WHERE user_id = auth.uid()));

-- Admins can view all penalty payments
CREATE POLICY "Admins can view all penalty payments"
  ON penalty_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Admins can update penalty payments (for verification)
CREATE POLICY "Admins can update penalty payments"
  ON penalty_payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Admins can delete penalty payments
CREATE POLICY "Admins can delete penalty payments"
  ON penalty_payments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );
