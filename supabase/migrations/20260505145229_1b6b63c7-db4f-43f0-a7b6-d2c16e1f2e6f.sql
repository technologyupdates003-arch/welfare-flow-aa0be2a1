
ALTER TABLE public.penalty_payments ADD COLUMN IF NOT EXISTS payment_message text;

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_type text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_name text;

ALTER TABLE public.conversation_participants ADD COLUMN IF NOT EXISTS last_read_at timestamptz NOT NULL DEFAULT now();

INSERT INTO storage.buckets (id, name, public) VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view chat attachments" ON storage.objects;
CREATE POLICY "Anyone can view chat attachments" ON storage.objects FOR SELECT USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "Authenticated can upload chat attachments" ON storage.objects;
CREATE POLICY "Authenticated can upload chat attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "Authenticated can update own chat attachments" ON storage.objects;
CREATE POLICY "Authenticated can update own chat attachments" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'chat-attachments' AND owner = auth.uid());

DROP POLICY IF EXISTS "Authenticated can delete own chat attachments" ON storage.objects;
CREATE POLICY "Authenticated can delete own chat attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'chat-attachments' AND owner = auth.uid());
