-- Add Treasurer Tables and Policies
-- Run this AFTER the enum migration has been committed

-- Step 1: Create expenses table for treasurer management
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_type VARCHAR(50) NOT NULL CHECK (expense_type IN ('operational', 'payout', 'emergency', 'other')),
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  recipient_name VARCHAR(255),
  recipient_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  payment_method VARCHAR(50),
  reference_number VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_by UUID REFERENCES auth.users(id),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create payouts table for member benefit payouts
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  payout_type VARCHAR(50) NOT NULL CHECK (payout_type IN ('wedding', 'death', 'retirement', 'emergency')),
  amount DECIMAL(10, 2) NOT NULL,
  eligible_amount DECIMAL(10, 2) NOT NULL,
  reason TEXT,
  supporting_documents TEXT[],
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_by UUID REFERENCES auth.users(id),
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_reference VARCHAR(100),
  rejection_reason TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create financial_reports table
CREATE TABLE IF NOT EXISTS financial_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('monthly', 'quarterly', 'annual', 'custom')),
  report_period_start DATE NOT NULL,
  report_period_end DATE NOT NULL,
  total_contributions DECIMAL(10, 2) DEFAULT 0,
  total_expenses DECIMAL(10, 2) DEFAULT 0,
  total_payouts DECIMAL(10, 2) DEFAULT 0,
  net_balance DECIMAL(10, 2) DEFAULT 0,
  report_data JSONB,
  generated_by UUID REFERENCES auth.users(id) NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create organization_settings table for treasurer
CREATE TABLE IF NOT EXISTS organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name VARCHAR(255) NOT NULL DEFAULT 'KHCWW',
  organization_address TEXT,
  organization_email VARCHAR(255),
  organization_phone VARCHAR(20),
  logo_url TEXT,
  signature_url TEXT,
  stamp_url TEXT,
  letterhead_template TEXT,
  payout_rules JSONB DEFAULT '{"wedding": 25000, "death": 50000, "retirement": 30000, "emergency": 15000}'::jsonb,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default organization settings with contact details
INSERT INTO organization_settings (
  organization_name, 
  organization_address,
  organization_email,
  organization_phone,
  payout_rules
)
VALUES (
  'KIRINYAGA HEALTHCARE WORKERS'' WELFARE', 
  'P.O.BOX 24-10300 KERUGOYA, LOCATION: KCRH',
  'Khcww2020@gmail.com',
  '+254 712 345 678',
  '{"wedding": 25000, "death": 50000, "retirement": 30000, "emergency": 15000}'::jsonb
)
ON CONFLICT DO NOTHING;

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_payouts_member_id ON payouts(member_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON payouts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_reports_period ON financial_reports(report_period_start, report_period_end);

-- Step 6: Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

-- Step 7: RLS Policies for expenses
CREATE POLICY "Treasurer can view all expenses" ON expenses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Treasurer can create expenses" ON expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin')
    )
  );

CREATE POLICY "Treasurer can update expenses" ON expenses
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin', 'super_admin')
    )
  );

-- Step 8: RLS Policies for payouts
CREATE POLICY "Treasurer can view all payouts" ON payouts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Treasurer can create payouts" ON payouts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin')
    )
  );

CREATE POLICY "Treasurer can update payouts" ON payouts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Members can view their own payouts" ON payouts
  FOR SELECT
  TO authenticated
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- Step 9: RLS Policies for financial_reports
CREATE POLICY "Treasurer can view all reports" ON financial_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Treasurer can create reports" ON financial_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin')
    )
  );

-- Step 10: RLS Policies for organization_settings
CREATE POLICY "Treasurer can view organization settings" ON organization_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Treasurer can update organization settings" ON organization_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin', 'super_admin')
    )
  );

-- Step 11: Grant treasurer access to existing tables
-- Treasurer can view all contributions
CREATE POLICY "Treasurer can view all contributions" ON contributions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin', 'super_admin')
    )
  );

-- Treasurer can view all payments
CREATE POLICY "Treasurer can view all payments" ON payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin', 'super_admin')
    )
  );

-- Treasurer can view all members
CREATE POLICY "Treasurer can view all members" ON members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin', 'super_admin')
    )
  );

COMMENT ON TABLE expenses IS 'Tracks all organizational expenses managed by treasurer';
COMMENT ON TABLE payouts IS 'Tracks member benefit payouts (wedding, death, retirement, etc.)';
COMMENT ON TABLE financial_reports IS 'Generated financial reports for different periods';
COMMENT ON TABLE organization_settings IS 'Organization configuration including payout rules and branding';
