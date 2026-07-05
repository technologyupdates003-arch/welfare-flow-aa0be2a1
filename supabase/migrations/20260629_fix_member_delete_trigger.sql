-- Fix the member delete trigger to avoid "tuple was already modified" errors
-- The issue is the trigger tries to update the auth user during delete, which conflicts with CASCADE

-- Drop the problematic trigger
DROP TRIGGER IF EXISTS trigger_delete_member_auth_user ON public.members;

-- Drop the function
DROP FUNCTION IF EXISTS public.delete_member_auth_user();

-- Create a simpler version that just logs instead of updating
CREATE OR REPLACE FUNCTION public.delete_member_auth_cleanup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log the deletion for audit (don't try to update auth user during delete)
  RAISE NOTICE 'Member deleted: %', OLD.id;
  RETURN OLD;
END;
$$;

-- Create the trigger with the new function
CREATE TRIGGER trigger_delete_member_cleanup
BEFORE DELETE ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.delete_member_auth_cleanup();
