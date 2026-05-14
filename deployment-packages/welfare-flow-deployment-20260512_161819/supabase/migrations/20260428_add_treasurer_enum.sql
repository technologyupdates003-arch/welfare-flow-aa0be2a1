-- Add Treasurer to app_role enum
-- This must be run separately and committed before using the value

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'treasurer';
