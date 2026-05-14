
-- Conversations table
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'private' CHECK (type IN ('private', 'group')),
  name text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Conversation participants
CREATE TABLE public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Message reactions
CREATE TABLE public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- User presence
CREATE TABLE public.user_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  is_online boolean NOT NULL DEFAULT false,
  last_seen timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Add conversation_id and reply_to_id to messages
ALTER TABLE public.messages ADD COLUMN conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

-- Enable realtime for presence and messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

-- RLS: conversations - participants can view
CREATE POLICY "Participants can view conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated users can create conversations" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admin can manage conversations" ON public.conversations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- RLS: conversation_participants
CREATE POLICY "Participants can view participants" ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (conversation_id IN (SELECT conversation_id FROM public.conversation_participants cp WHERE cp.user_id = auth.uid()));

CREATE POLICY "Conversation creator can add participants" ON public.conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (conversation_id IN (SELECT id FROM public.conversations WHERE created_by = auth.uid()) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can manage participants" ON public.conversation_participants
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- RLS: message_reactions
CREATE POLICY "Anyone in conversation can view reactions" ON public.message_reactions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can add reactions" ON public.message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions" ON public.message_reactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- RLS: user_presence
CREATE POLICY "Anyone can view presence" ON public.user_presence
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can manage own presence" ON public.user_presence
  FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- Update messages RLS for conversation-based access
CREATE POLICY "Participants can view conversation messages" ON public.messages
  FOR SELECT TO authenticated
  USING (
    conversation_id IS NULL
    OR conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "Participants can send conversation messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      conversation_id IS NULL
      OR conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
    )
  );

-- Trigger for conversations updated_at
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
