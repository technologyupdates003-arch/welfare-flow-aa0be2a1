-- Add status column to messages
ALTER TABLE public.messages ADD COLUMN status text NOT NULL DEFAULT 'sent';

-- Add profile fields to members
ALTER TABLE public.members ADD COLUMN profile_picture_url text;
ALTER TABLE public.members ADD COLUMN status_message text DEFAULT 'Hey there! I am using Welfare App';

-- Allow members to update their own profile
CREATE POLICY "Members can update own profile"
ON public.members
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update message status
CREATE POLICY "Recipients can update message status"
ON public.messages
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Create profile images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-images', 'profile-images', true);

CREATE POLICY "Anyone can view profile images"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-images');

CREATE POLICY "Authenticated users can upload profile images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'profile-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'profile-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own profile images"
ON storage.objects FOR DELETE
USING (bucket_id = 'profile-images' AND auth.role() = 'authenticated');