-- Create a function to assign roles to users (for admin use)
CREATE OR REPLACE FUNCTION assign_user_role(user_id_param UUID, role_param app_role)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_roles (user_id, role)
  VALUES (user_id_param, role_param)
  ON CONFLICT (user_id) 
  DO UPDATE SET role = role_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (admins can use this)
GRANT EXECUTE ON FUNCTION assign_user_role TO authenticated;

-- Add RLS policy for the new roles (drop existing if exists)
DROP POLICY IF EXISTS "Office bearers can view member data" ON members;
CREATE POLICY "Office bearers can view member data" ON members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('chairperson', 'vice_chairperson', 'secretary', 'vice_secretary', 'patron', 'admin')
    )
  );

-- Allow secretaries to manage events
DROP POLICY IF EXISTS "Secretaries can manage events" ON events;
CREATE POLICY "Secretaries can manage events" ON events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('secretary', 'admin')
    )
  );

-- Allow office bearers to view payments (read-only for most)
DROP POLICY IF EXISTS "Office bearers can view payments" ON payments;
CREATE POLICY "Office bearers can view payments" ON payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('chairperson', 'vice_chairperson', 'secretary', 'vice_secretary', 'patron', 'admin')
    )
  );

-- Allow office bearers to view contributions
DROP POLICY IF EXISTS "Office bearers can view contributions" ON contributions;
CREATE POLICY "Office bearers can view contributions" ON contributions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('chairperson', 'vice_chairperson', 'secretary', 'vice_secretary', 'patron', 'admin')
    )
  );

-- Allow office bearers to view penalties
DROP POLICY IF EXISTS "Office bearers can view penalties" ON penalties;
CREATE POLICY "Office bearers can view penalties" ON penalties
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('chairperson', 'vice_chairperson', 'secretary', 'vice_secretary', 'patron', 'admin')
    )
  );

-- Allow office bearers to view documents
DROP POLICY IF EXISTS "Office bearers can view documents" ON documents;
CREATE POLICY "Office bearers can view documents" ON documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('chairperson', 'vice_chairperson', 'secretary', 'vice_secretary', 'patron', 'admin')
    )
  );

-- Allow office bearers to view beneficiaries
DROP POLICY IF EXISTS "Office bearers can view beneficiaries" ON beneficiaries;
CREATE POLICY "Office bearers can view beneficiaries" ON beneficiaries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('chairperson', 'vice_chairperson', 'secretary', 'vice_secretary', 'patron', 'admin')
    )
  );