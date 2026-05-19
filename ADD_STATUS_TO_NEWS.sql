-- Add status column to news table to support active/archived news
ALTER TABLE public.news
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived'));

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_news_status ON public.news(status);

-- Update existing news to be active
UPDATE public.news SET status = 'active' WHERE status IS NULL;
