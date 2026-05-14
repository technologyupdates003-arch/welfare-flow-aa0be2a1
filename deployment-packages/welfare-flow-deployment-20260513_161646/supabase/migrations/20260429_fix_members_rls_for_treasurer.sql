-- Fix RLS policies for members table to allow treasurer access
-- This migration ensures that authenticated users (including treasurer) can read member data

-- First, check current RLS status
-- SELECT * FROM pg_tables WHERE tablename = 'members';

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "members_select_policy" ON members;
DROP POLICY IF EXISTS "members_insert_policy" ON members;
DROP POLICY IF EXISTS "members_update_policy" ON members;
DROP POLICY IF EXISTS "members_delete_policy" ON members;

-- Enable RLS on members table
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Create permissive SELECT policy for authenticated users
CREATE POLICY "members_select_authenticated"
  ON members
  FOR SELECT
  TO authenticated
  USING (true);

-- Create INSERT policy for admin/super_admin
CREATE POLICY "members_insert_admin"
  ON members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Create UPDATE policy for admin/super_admin
CREATE POLICY "members_update_admin"
  ON members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Create DELETE policy for admin/super_admin
CREATE POLICY "members_delete_admin"
  ON members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Grant permissions to authenticated role
GRANT SELECT ON members TO authenticated;
GRANT INSERT ON members TO authenticated;
GRANT UPDATE ON members TO authenticated;
GRANT DELETE ON members TO authenticated;
