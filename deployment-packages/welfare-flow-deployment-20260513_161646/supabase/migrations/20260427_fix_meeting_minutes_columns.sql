-- Fix meeting_minutes columns - change from UUID to VARCHAR/TEXT

-- Drop the problematic columns
ALTER TABLE public.meeting_minutes
DROP COLUMN IF EXISTS chairperson_name CASCADE;

ALTER TABLE public.meeting_minutes
DROP COLUMN IF EXISTS secretary_name CASCADE;

ALTER TABLE public.meeting_minutes
DROP COLUMN IF EXISTS chairperson_signature_url CASCADE;

ALTER TABLE public.meeting_minutes
DROP COLUMN IF EXISTS secretary_signature_url CASCADE;

-- Recreate with correct types
ALTER TABLE public.meeting_minutes
ADD COLUMN chairperson_name VARCHAR(255);

ALTER TABLE public.meeting_minutes
ADD COLUMN chairperson_signature_url TEXT;

ALTER TABLE public.meeting_minutes
ADD COLUMN secretary_name VARCHAR(255);

ALTER TABLE public.meeting_minutes
ADD COLUMN secretary_signature_url TEXT;
