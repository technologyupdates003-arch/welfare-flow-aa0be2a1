-- Create Enhanced Super Admin Role with Full System Access
-- This role has complete access to all system functions including:
-- - View/reset member passwords
-- - Read all private chats and messages
-- - Full system troubleshooting capabilities
-- - Complete administrative control

-- Add super_admin to the app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Create super admin functions for enhanced capabilities

-- Function to reset member password (super admin only)
CREATE OR REPLACE FUNCTION reset_member_password(
  target_user_id UUID,
  new_password TEXT
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if current user is super admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Super admin role required';
  END IF;

  -- Update the user's password in auth.users
  UPDATE auth.users 
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;

  -- Log the password reset action
  INSERT INTO sms_logs (recipient_phone, message, status, sent_at)
  VALUES (
    'SYSTEM_LOG',
    'Password reset for user ' || target_user_id || ' by super admin ' || auth.uid(),
    'logged',
    NOW()
  );

  RETURN TRUE;
END;
$$;

-- Function to get member password info (super admin only)
CREATE OR REPLACE FUNCTION get_member_auth_info(target_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  phone TEXT,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  email_confirmed_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if current user is super admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Super admin role required';
  END IF;

  RETURN QUERY
  SELECT 
    au.id,
    au.email,
    au.phone,
    au.last_sign_in_at,
    au.created_at,
    au.email_confirmed_at
  FROM auth.users au
  WHERE au.id = target_user_id;
END;
$$;

-- Function to read all private messages (super admin only)
CREATE OR REPLACE FUNCTION get_all_private_messages(
  conversation_id_param UUID DEFAULT NULL,
  user_id_param UUID DEFAULT NULL,
  limit_param INTEGER DEFAULT 100
)
RETURNS TABLE (
  message_id UUID,
  conversation_id UUID,
  sender_id UUID,
  sender_email TEXT,
  content TEXT,
  created_at TIMESTAMPTZ,
  conversation_type TEXT,
  participants TEXT[]
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if current user is super admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Super admin role required';
  END IF;

  RETURN QUERY
  SELECT 
    m.id as message_id,
    m.conversation_id,
    m.user_id as sender_id,
    au.email as sender_email,
    m.content,
    m.created_at,
    c.type as conversation_type,
    ARRAY(
      SELECT au2.email 
      FROM conversation_participants cp2 
      JOIN auth.users au2 ON cp2.user_id = au2.id
      WHERE cp2.conversation_id = m.conversation_id
    ) as participants
  FROM messages m
  JOIN conversations c ON m.conversation_id = c.id
  JOIN auth.users au ON m.user_id = au.id
  WHERE 
    (conversation_id_param IS NULL OR m.conversation_id = conversation_id_param)
    AND (user_id_param IS NULL OR m.user_id = user_id_param)
  ORDER BY m.created_at DESC
  LIMIT limit_param;
END;
$$;

-- Function to get system diagnostics (super admin only)
CREATE OR REPLACE FUNCTION get_system_diagnostics()
RETURNS TABLE (
  metric_name TEXT,
  metric_value TEXT,
  last_updated TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if current user is super admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Super admin role required';
  END IF;

  RETURN QUERY
  SELECT 
    'Total Members'::TEXT,
    COUNT(*)::TEXT,
    NOW()
  FROM members
  UNION ALL
  SELECT 
    'Total Users'::TEXT,
    COUNT(*)::TEXT,
    NOW()
  FROM auth.users
  UNION ALL
  SELECT 
    'Total Messages'::TEXT,
    COUNT(*)::TEXT,
    NOW()
  FROM messages
  UNION ALL
  SELECT 
    'Total Conversations'::TEXT,
    COUNT(*)::TEXT,
    NOW()
  FROM conversations
  UNION ALL
  SELECT 
    'Total Contributions'::TEXT,
    COUNT(*)::TEXT,
    NOW()
  FROM contributions
  UNION ALL
  SELECT 
    'Total Payments'::TEXT,
    COUNT(*)::TEXT,
    NOW()
  FROM payments
  UNION ALL
  SELECT 
    'Unmatched Payments'::TEXT,
    COUNT(*)::TEXT,
    NOW()
  FROM unmatched_payments
  UNION ALL
  SELECT 
    'Active Penalties'::TEXT,
    COUNT(*)::TEXT,
    NOW()
  FROM penalties
  WHERE status = 'active'
  UNION ALL
  SELECT 
    'SMS Logs (Last 30 days)'::TEXT,
    COUNT(*)::TEXT,
    NOW()
  FROM sms_logs
  WHERE sent_at > NOW() - INTERVAL '30 days';
END;
$$;

-- Function to get detailed error logs (super admin only)
CREATE OR REPLACE FUNCTION get_error_logs(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
  log_id UUID,
  error_type TEXT,
  error_message TEXT,
  user_id UUID,
  user_email TEXT,
  occurred_at TIMESTAMPTZ,
  additional_info JSONB
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if current user is super admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Super admin role required';
  END IF;

  -- Return error information from SMS logs and other sources
  RETURN QUERY
  SELECT 
    sl.id as log_id,
    'SMS_ERROR'::TEXT as error_type,
    sl.message as error_message,
    NULL::UUID as user_id,
    sl.recipient_phone as user_email,
    sl.sent_at as occurred_at,
    jsonb_build_object('status', sl.status, 'phone', sl.recipient_phone) as additional_info
  FROM sms_logs sl
  WHERE sl.status = 'failed' 
    AND sl.sent_at > NOW() - INTERVAL '1 day' * days_back
  ORDER BY sl.sent_at DESC;
END;
$$;

-- Create comprehensive RLS policies for super admin access

-- Super admin can access ALL data in ALL tables
CREATE POLICY "Super admin full access to user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to members" ON public.members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to contributions" ON public.contributions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to payments" ON public.payments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to penalties" ON public.penalties
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to messages" ON public.messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to conversations" ON public.conversations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to conversation_participants" ON public.conversation_participants
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to news" ON public.news
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to events" ON public.events
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to documents" ON public.documents
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to sms_logs" ON public.sms_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to unmatched_payments" ON public.unmatched_payments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to welfare_settings" ON public.welfare_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Add policies for newer tables
CREATE POLICY "Super admin full access to beneficiaries" ON public.beneficiaries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to meeting_minutes" ON public.meeting_minutes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to beneficiary_requests" ON public.beneficiary_requests
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to news_read" ON public.news_read
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to office_bearer_signatures" ON public.office_bearer_signatures
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Storage policies for super admin
CREATE POLICY "Super admin full access to documents storage" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'documents' AND 
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access to signatures storage" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'signatures' AND 
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Grant super admin the ability to assign any role to any user
CREATE OR REPLACE FUNCTION super_admin_assign_role(
  target_user_id UUID,
  target_role app_role
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if current user is super admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Super admin role required';
  END IF;

  -- Remove existing role for this user
  DELETE FROM user_roles WHERE user_id = target_user_id;
  
  -- Assign new role
  INSERT INTO user_roles (user_id, role, assigned_at, assigned_by)
  VALUES (target_user_id, target_role, NOW(), auth.uid());

  -- Log the role assignment
  INSERT INTO sms_logs (recipient_phone, message, status, sent_at)
  VALUES (
    'SYSTEM_LOG',
    'Role ' || target_role || ' assigned to user ' || target_user_id || ' by super admin ' || auth.uid(),
    'logged',
    NOW()
  );
END;
$$;

-- Create a view for super admin dashboard
CREATE OR REPLACE VIEW super_admin_dashboard AS
SELECT 
  'system_overview' as section,
  jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM auth.users),
    'total_members', (SELECT COUNT(*) FROM members),
    'active_conversations', (SELECT COUNT(*) FROM conversations),
    'total_messages', (SELECT COUNT(*) FROM messages),
    'pending_requests', (SELECT COUNT(*) FROM beneficiary_requests WHERE status = 'pending'),
    'failed_sms', (SELECT COUNT(*) FROM sms_logs WHERE status = 'failed' AND sent_at > NOW() - INTERVAL '24 hours'),
    'unmatched_payments', (SELECT COUNT(*) FROM unmatched_payments)
  ) as data
UNION ALL
SELECT 
  'recent_activity' as section,
  jsonb_build_object(
    'recent_messages', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'content', LEFT(m.content, 100),
          'sender', au.email,
          'created_at', m.created_at
        )
      )
      FROM messages m
      JOIN auth.users au ON m.user_id = au.id
      ORDER BY m.created_at DESC
      LIMIT 10
    ),
    'recent_registrations', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', au.id,
          'email', au.email,
          'created_at', au.created_at
        )
      )
      FROM auth.users au
      ORDER BY au.created_at DESC
      LIMIT 5
    )
  ) as data;

-- Grant access to super admin dashboard view
CREATE POLICY "Super admin can view dashboard" ON super_admin_dashboard
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

COMMENT ON TYPE app_role IS 'Application roles: member, admin, chairperson, vice_chairperson, secretary, vice_secretary, patron, super_admin';
COMMENT ON FUNCTION reset_member_password IS 'Super admin function to reset any member password';
COMMENT ON FUNCTION get_member_auth_info IS 'Super admin function to view member authentication details';
COMMENT ON FUNCTION get_all_private_messages IS 'Super admin function to read all private messages for troubleshooting';
COMMENT ON FUNCTION get_system_diagnostics IS 'Super admin function to get comprehensive system metrics';
COMMENT ON FUNCTION super_admin_assign_role IS 'Super admin function to assign any role to any user';