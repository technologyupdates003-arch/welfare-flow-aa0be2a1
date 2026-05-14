ALTER TABLE public.meeting_minutes
  ADD COLUMN IF NOT EXISTS secretary_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS secretary_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS secretary_notes text;

CREATE INDEX IF NOT EXISTS idx_meeting_minutes_status_workflow ON public.meeting_minutes(status);