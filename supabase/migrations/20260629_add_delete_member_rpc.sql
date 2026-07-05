-- Create RPC function for admin to delete members safely
-- This function handles cascading deletion of all member-related data
-- Lets database CASCADE constraints handle deletions

CREATE OR REPLACE FUNCTION delete_member_safe(target_member_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_name TEXT;
BEGIN
  -- Verify that the calling user is admin
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only admins can delete members'
    );
  END IF;

  -- Get member name for logging
  SELECT name INTO member_name FROM members WHERE id = target_member_id;
  
  IF member_name IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Member not found'
    );
  END IF;

  BEGIN
    -- Delete unmatched_payments that reference payments by this member
    DELETE FROM unmatched_payments 
    WHERE payment_id IN (
      SELECT id FROM payments WHERE member_id = target_member_id
    );
    
    -- Delete the member - CASCADE will handle contributions, penalties, payments, beneficiaries
    DELETE FROM members WHERE id = target_member_id;

    RETURN json_build_object(
      'success', true,
      'message', 'Member deleted successfully',
      'deleted_member', member_name
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
  END;
END;
$$;

-- Grant execute permission to authenticated users (specifically admins via check in function)
GRANT EXECUTE ON FUNCTION delete_member_safe TO authenticated;
