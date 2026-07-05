-- Add status field to members table for suspend/deactivate functionality
-- status: 'active' (default), 'suspended' (temporarily suspended), 'deactivated' (permanently deactivated)

ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' 
CHECK (status IN ('active', 'suspended', 'deactivated'));

-- Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_members_status ON public.members(status);

-- Update existing records - if is_active is false, set status to deactivated
UPDATE public.members SET status = 'deactivated' WHERE is_active = false;
UPDATE public.members SET status = 'active' WHERE is_active = true AND status = 'active';

-- Create RPC function to update member status
CREATE OR REPLACE FUNCTION update_member_status(
  target_member_id UUID,
  new_status TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  member_name TEXT;
BEGIN
  -- Verify that the calling user is admin
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Only admins can change member status'
    );
  END IF;

  -- Validate status
  IF new_status NOT IN ('active', 'suspended', 'deactivated') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid status. Must be: active, suspended, or deactivated'
    );
  END IF;

  -- Get member name
  SELECT name INTO member_name FROM members WHERE id = target_member_id;
  
  IF member_name IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Member not found'
    );
  END IF;

  -- Update status
  UPDATE members SET status = new_status, updated_at = now() WHERE id = target_member_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Member status updated',
    'member_name', member_name,
    'new_status', new_status
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_member_status TO authenticated;
