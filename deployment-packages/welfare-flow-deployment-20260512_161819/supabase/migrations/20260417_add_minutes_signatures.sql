-- Add signature fields to meeting_minutes table
ALTER TABLE meeting_minutes 
ADD COLUMN IF NOT EXISTS chairperson_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS chairperson_signature_url TEXT,
ADD COLUMN IF NOT EXISTS secretary_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS secretary_signature_url TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_chairperson ON meeting_minutes(chairperson_name);
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_secretary ON meeting_minutes(secretary_name);
