-- Create news_read table to track which news members have read
CREATE TABLE IF NOT EXISTS news_read (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id UUID NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(news_id, user_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_news_read_user_id ON news_read(user_id);
CREATE INDEX IF NOT EXISTS idx_news_read_news_id ON news_read(news_id);

-- Enable RLS
ALTER TABLE news_read ENABLE ROW LEVEL SECURITY;

-- Users can view their own read status
CREATE POLICY "Users can view own read status" ON news_read
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can mark news as read
CREATE POLICY "Users can mark news as read" ON news_read
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Add profile_picture_url to members table if not exists
ALTER TABLE members ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
