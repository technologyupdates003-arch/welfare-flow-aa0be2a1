-- Create Memos System for Treasurer
-- This migration adds memo management with tracking and recipient management

-- Step 1: Create memos table
CREATE TABLE IF NOT EXISTS memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('financial_notice', 'contribution_reminder', 'penalty_notice', 'payout_notification', 'general_communication')),
  content TEXT NOT NULL,
  recipient_type VARCHAR(50) NOT NULL CHECK (recipient_type IN ('all_members', 'executives_only', 'custom_selection')),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  attachments TEXT[],
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create memo_recipients table (for custom selection and tracking)
CREATE TABLE IF NOT EXISTS memo_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id UUID REFERENCES memos(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  delivered_at TIMESTAMP WITH TIME ZONE,
  seen_at TIMESTAMP WITH TIME ZONE,
  downloaded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(memo_id, member_id)
);

-- Step 3: Create memo_templates table
CREATE TABLE IF NOT EXISTS memo_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  template_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create function to generate reference number
CREATE OR REPLACE FUNCTION generate_memo_reference()
RETURNS TEXT AS $$
DECLARE
  year TEXT;
  count INTEGER;
  ref_number TEXT;
BEGIN
  year := TO_CHAR(NOW(), 'YYYY');
  
  -- Get count of memos this year
  SELECT COUNT(*) INTO count
  FROM memos
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
  
  -- Generate reference number
  ref_number := 'KHCWW-MEMO-' || year || '-' || LPAD((count + 1)::TEXT, 3, '0');
  
  RETURN ref_number;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger to auto-generate reference number
CREATE OR REPLACE FUNCTION set_memo_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference_number IS NULL OR NEW.reference_number = '' THEN
    NEW.reference_number := generate_memo_reference();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_memo_reference
  BEFORE INSERT ON memos
  FOR EACH ROW
  EXECUTE FUNCTION set_memo_reference();

-- Step 6: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_memos_status ON memos(status);
CREATE INDEX IF NOT EXISTS idx_memos_category ON memos(category);
CREATE INDEX IF NOT EXISTS idx_memos_created_at ON memos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memos_reference ON memos(reference_number);
CREATE INDEX IF NOT EXISTS idx_memo_recipients_memo_id ON memo_recipients(memo_id);
CREATE INDEX IF NOT EXISTS idx_memo_recipients_member_id ON memo_recipients(member_id);
CREATE INDEX IF NOT EXISTS idx_memo_recipients_seen ON memo_recipients(seen_at);

-- Step 7: Enable RLS
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE memo_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE memo_templates ENABLE ROW LEVEL SECURITY;

-- Step 8: RLS Policies for memos
CREATE POLICY "Treasurer can view all memos" ON memos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Treasurer can create memos" ON memos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin')
    )
  );

CREATE POLICY "Treasurer can update memos" ON memos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Treasurer can delete memos" ON memos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin', 'super_admin')
    )
    AND status = 'draft'
  );

-- Step 9: RLS Policies for memo_recipients
CREATE POLICY "Treasurer can view all memo recipients" ON memo_recipients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Treasurer can manage memo recipients" ON memo_recipients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin')
    )
  );

CREATE POLICY "Members can view their own memo receipts" ON memo_recipients
  FOR SELECT
  TO authenticated
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

CREATE POLICY "Members can update their own memo tracking" ON memo_recipients
  FOR UPDATE
  TO authenticated
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- Step 10: RLS Policies for memo_templates
CREATE POLICY "Treasurer can view all templates" ON memo_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Treasurer can manage templates" ON memo_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin')
    )
  );

-- Step 11: Insert default memo templates
INSERT INTO memo_templates (name, category, template_content, variables, created_by)
SELECT 
  'Late Payment Notice',
  'contribution_reminder',
  E'Dear {member_name},\n\nThis is to remind you that your contribution payment for {month} is overdue.\n\nAmount Due: Ksh {amount_due}\nPenalty: Ksh {penalty}\nTotal Amount: Ksh {total_amount}\n\nPlease make your payment at your earliest convenience to avoid further penalties.\n\nThank you for your cooperation.',
  '["member_name", "month", "amount_due", "penalty", "total_amount"]'::jsonb,
  (SELECT id FROM auth.users LIMIT 1)
WHERE EXISTS (SELECT 1 FROM auth.users LIMIT 1)
ON CONFLICT DO NOTHING;

INSERT INTO memo_templates (name, category, template_content, variables, created_by)
SELECT 
  'Payout Approval Notice',
  'payout_notification',
  E'Dear {member_name},\n\nWe are pleased to inform you that your payout request has been approved.\n\nEvent Type: {event_type}\nApproved Amount: Ksh {amount}\nReference Number: {reference}\n\nThe payment will be processed within 3-5 business days.\n\nCongratulations!',
  '["member_name", "event_type", "amount", "reference"]'::jsonb,
  (SELECT id FROM auth.users LIMIT 1)
WHERE EXISTS (SELECT 1 FROM auth.users LIMIT 1)
ON CONFLICT DO NOTHING;

INSERT INTO memo_templates (name, category, template_content, variables, created_by)
SELECT 
  'Penalty Notice',
  'penalty_notice',
  E'Dear {member_name},\n\nThis is to inform you that a penalty has been applied to your account.\n\nReason: {reason}\nPenalty Amount: Ksh {penalty_amount}\nDue Date: {due_date}\n\nPlease settle this amount to maintain your membership in good standing.\n\nFor any queries, please contact the treasurer.',
  '["member_name", "reason", "penalty_amount", "due_date"]'::jsonb,
  (SELECT id FROM auth.users LIMIT 1)
WHERE EXISTS (SELECT 1 FROM auth.users LIMIT 1)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE memos IS 'Official memos created and sent by treasurer';
COMMENT ON TABLE memo_recipients IS 'Tracks memo delivery and engagement per member';
COMMENT ON TABLE memo_templates IS 'Reusable memo templates with variable substitution';
