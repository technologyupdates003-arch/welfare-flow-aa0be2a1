
-- Create a function that deletes the auth user when a member is deleted
CREATE OR REPLACE FUNCTION public.delete_member_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete user_roles first
  DELETE FROM public.user_roles WHERE user_id = OLD.user_id;
  -- Delete user_presence
  DELETE FROM public.user_presence WHERE user_id = OLD.user_id;
  -- Delete conversation_participants
  DELETE FROM public.conversation_participants WHERE user_id = OLD.user_id;
  -- Delete messages by this user
  DELETE FROM public.messages WHERE user_id = OLD.user_id;
  -- Delete message_reactions by this user
  DELETE FROM public.message_reactions WHERE user_id = OLD.user_id;
  -- Delete notifications for this user
  DELETE FROM public.notifications WHERE user_id = OLD.user_id;
  -- Finally delete the auth user
  IF OLD.user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;

-- Trigger before delete on members to clean up auth user
CREATE TRIGGER trigger_delete_member_auth_user
BEFORE DELETE ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.delete_member_auth_user();
