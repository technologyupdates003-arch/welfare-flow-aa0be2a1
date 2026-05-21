-- Fix Memo RLS Policies to allow all authenticated users to view memos
-- This ensures memos are accessible even if user doesn't have treasurer role

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Treasurer can view all memos" ON memos;
DROP POLICY IF EXISTS "Treasurer can create memos" ON memos;
DROP POLICY IF EXISTS "Treasurer can update memos" ON memos;
DROP POLICY IF EXISTS "Treasurer can delete memos" ON memos;

-- Create new policies that allow all authenticated users to view memos
CREATE POLICY "All authenticated users can view memos" ON memos
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Treasurer can create memos" ON memos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin', 'super_admin')
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

-- Also fix memo_recipients policies
DROP POLICY IF EXISTS "Treasurer can view all memo recipients" ON memo_recipients;
DROP POLICY IF EXISTS "Treasurer can manage memo recipients" ON memo_recipients;
DROP POLICY IF EXISTS "Members can view their own memo receipts" ON memo_recipients;
DROP POLICY IF EXISTS "Members can update their own memo tracking" ON memo_recipients;

CREATE POLICY "All authenticated users can view memo recipients" ON memo_recipients
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Treasurer can manage memo recipients" ON memo_recipients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('treasurer', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Members can update their own memo tracking" ON memo_recipients
  FOR UPDATE
  TO authenticated
  USING (
    member_id = auth.uid()
  );
