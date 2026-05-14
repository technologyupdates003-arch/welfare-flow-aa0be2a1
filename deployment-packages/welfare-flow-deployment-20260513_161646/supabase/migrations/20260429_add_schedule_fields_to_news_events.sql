-- Add schedule and reschedule date fields to news and events tables
-- This allows tracking of original scheduled dates and any rescheduling

-- Add columns to news table
ALTER TABLE news
ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rescheduled_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reschedule_reason TEXT;

-- Add columns to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rescheduled_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reschedule_reason TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_news_scheduled_date ON news(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_news_rescheduled_date ON news(rescheduled_date);
CREATE INDEX IF NOT EXISTS idx_events_scheduled_date ON events(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_events_rescheduled_date ON events(rescheduled_date);

-- Add comments for documentation
COMMENT ON COLUMN news.scheduled_date IS 'Original scheduled date for the news item';
COMMENT ON COLUMN news.rescheduled_date IS 'New date if the news was rescheduled';
COMMENT ON COLUMN news.reschedule_reason IS 'Reason for rescheduling the news';
COMMENT ON COLUMN events.scheduled_date IS 'Original scheduled date for the event';
COMMENT ON COLUMN events.rescheduled_date IS 'New date if the event was rescheduled';
COMMENT ON COLUMN events.reschedule_reason IS 'Reason for rescheduling the event';
