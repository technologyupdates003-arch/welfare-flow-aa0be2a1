-- Create RPC function for super admin to reset user passwords
-- This function allows super admin to reset any user's password

CREATE OR REPLACE FUNCTION admin_reset_password(
  target_user_id UUID,
  new_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  -- Verify that the calling user is a super admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only super admins can reset passwords'
    );
  END IF;

  -- Verify the target user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Update the user's password in auth.users
  UPDATE auth.users
  SET 
    encrypted_password = crypt(new_password, gen_salt('bf')),
    updated_at = now()
  WHERE id = target_user_id;

  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Password reset successfully',
    'user_id', target_user_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Grant execute permission to authenticated users (specifically super admins via check in function)
GRANT EXECUTE ON FUNCTION admin_reset_password TO authenticated;

-- Add a reason column to password_resets table if it doesn't exist
ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS reason TEXT;
