-- Drop the overly permissive policy
DROP POLICY "Recipients can update message status" ON public.messages;

-- Create a proper policy: only participants of the conversation can update status
CREATE POLICY "Participants can update message status"
ON public.messages
FOR UPDATE
USING (
  (conversation_id IS NULL AND auth.role() = 'authenticated')
  OR (conversation_id IN (
    SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
  ))
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  (conversation_id IS NULL AND auth.role() = 'authenticated')
  OR (conversation_id IN (
    SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
  ))
  OR has_role(auth.uid(), 'admin'::app_role)
);