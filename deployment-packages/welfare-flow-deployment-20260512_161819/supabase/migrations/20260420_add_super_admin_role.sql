-- ============================================================================
-- Create Super Admin Role with Enhanced Permissions
-- ============================================================================

-- IMPORTANT: Run this AFTER supabase/migrations/20260420_add_super_admin_enum.sql

-- Step 1: Create audit_logs table for tracking super admin actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(255) NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can view audit logs
CREATE POLICY "Super admins can view audit logs" ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Step 2: Create password_resets table for tracking password reset requests
CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reset_token VARCHAR(255) UNIQUE NOT NULL,
  reset_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reset_at TIMESTAMP WITH TIME ZONE,
  new_password_hash VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours'
);

-- Enable RLS on password_resets
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- Only super admins can view password resets
CREATE POLICY "Super admins can view password resets" ON password_resets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Super admins can insert password resets
CREATE POLICY "Super admins can create password resets" ON password_resets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Super admins can update password resets
CREATE POLICY "Super admins can update password resets" ON password_resets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Step 3: Create system_logs table for error tracking and troubleshooting
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_level VARCHAR(20) NOT NULL, -- ERROR, WARNING, INFO, DEBUG
  component VARCHAR(255),
  message TEXT NOT NULL,
  error_details JSONB,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_path VARCHAR(500),
  status_code INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on system_logs
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can view system logs
CREATE POLICY "Super admins can view system logs" ON system_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Super admins can update system logs (mark as resolved)
CREATE POLICY "Super admins can update system logs" ON system_logs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Step 4: Update conversation_participants RLS to allow super admin access
-- Super admins can view all conversations for troubleshooting
CREATE POLICY "Super admins can view all conversations" ON conversation_participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Step 5: Update messages RLS to allow super admin access
-- Super admins can view all messages for troubleshooting
CREATE POLICY "Super admins can view all messages" ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Step 6: Create member_access_logs table to track super admin member access
CREATE TABLE IF NOT EXISTS member_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  access_type VARCHAR(100) NOT NULL, -- view_profile, view_chat, reset_password, etc.
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on member_access_logs
ALTER TABLE member_access_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can view member access logs
CREATE POLICY "Super admins can view member access logs" ON member_access_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Super admins can insert member access logs
CREATE POLICY "Super admins can create member access logs" ON member_access_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Step 7: Create system_health table for monitoring system status
CREATE TABLE IF NOT EXISTS system_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name VARCHAR(255) NOT NULL,
  metric_value NUMERIC,
  status VARCHAR(50), -- healthy, warning, critical
  details JSONB,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on system_health
ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;

-- Only super admins can view system health
CREATE POLICY "Super admins can view system health" ON system_health
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- ============================================================================
-- Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_super_admin_id ON audit_logs(super_admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id ON audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_reset_token ON password_resets(reset_token);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON password_resets(expires_at);

CREATE INDEX IF NOT EXISTS idx_system_logs_log_level ON system_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_resolved ON system_logs(resolved);

CREATE INDEX IF NOT EXISTS idx_member_access_logs_super_admin_id ON member_access_logs(super_admin_id);
CREATE INDEX IF NOT EXISTS idx_member_access_logs_member_id ON member_access_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_member_access_logs_created_at ON member_access_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_health_metric_name ON system_health(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_health_checked_at ON system_health(checked_at DESC);

-- ============================================================================
-- DONE! Super Admin tables and policies created
-- ============================================================================

