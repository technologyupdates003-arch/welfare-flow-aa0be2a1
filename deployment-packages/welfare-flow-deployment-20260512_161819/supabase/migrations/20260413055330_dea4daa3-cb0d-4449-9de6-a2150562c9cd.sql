
-- Fix conversation_participants: replace self-referencing SELECT policy
DROP POLICY IF EXISTS "Participants can view participants" ON public.conversation_participants;
CREATE POLICY "Participants can view participants" ON public.conversation_participants
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR conversation_id IN (
    SELECT cp2.conversation_id FROM public.conversation_participants cp2 WHERE cp2.user_id = auth.uid()
  )
);

-- Actually the above still self-references. Use security definer function instead.
DROP POLICY IF EXISTS "Participants can view participants" ON public.conversation_participants;

CREATE OR REPLACE FUNCTION public.get_user_conversation_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT conversation_id FROM public.conversation_participants WHERE user_id = _user_id;
$$;

CREATE POLICY "Participants can view participants" ON public.conversation_participants
FOR SELECT TO authenticated
USING (
  conversation_id IN (SELECT public.get_user_conversation_ids(auth.uid()))
);

-- Fix conversations SELECT policy similarly
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations" ON public.conversations
FOR SELECT TO authenticated
USING (
  id IN (SELECT public.get_user_conversation_ids(auth.uid()))
);
