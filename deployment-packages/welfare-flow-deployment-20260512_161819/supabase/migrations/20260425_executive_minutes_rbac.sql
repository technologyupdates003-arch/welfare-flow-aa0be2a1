-- Executive Minutes with Role-Based Access Control

-- Create meeting_attendance table
CREATE TABLE IF NOT EXISTS public.meeting_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meeting_minutes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'apology')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(meeting_id, user_id)
);

ALTER TABLE public.meeting_attendance ENABLE ROW LEVEL SECURITY;

-- Add meeting type column if it doesn't exist
ALTER TABLE public.meeting_minutes 
ADD COLUMN IF NOT EXISTS meeting_type TEXT DEFAULT 'general' CHECK (meeting_type IN ('general', 'executive'));

-- RLS Policies for meeting_attendance
CREATE POLICY "Anyone can read attendance"
  ON public.meeting_attendance FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage attendance"
  ON public.meeting_attendance FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'super_admin')
    )
  );

-- Update meeting_minutes RLS to enforce executive access control
DROP POLICY IF EXISTS "Members can view approved general minutes" ON public.meeting_minutes;
DROP POLICY IF EXISTS "Members with roles can view executive minutes" ON public.meeting_minutes;

-- General minutes: anyone can view if approved
CREATE POLICY "Anyone can view approved general minutes"
  ON public.meeting_minutes FOR SELECT
  USING (
    (meeting_type = 'general' AND status = 'approved')
    OR
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'super_admin', 'secretary', 'chairperson')
    )
  );

-- Executive minutes: ONLY users with roles can view
CREATE POLICY "Only role members can view executive minutes"
  ON public.meeting_minutes FOR SELECT
  USING (
    (meeting_type = 'executive' AND 
     EXISTS (
       SELECT 1 FROM user_roles ur
       WHERE ur.user_id = auth.uid()
       AND ur.role IN ('admin', 'super_admin', 'chairperson', 'vice_chairperson', 'secretary', 'vice_secretary', 'patron')
     ))
    OR
    (meeting_type = 'general' AND status = 'approved')
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_meeting_id ON public.meeting_attendance(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_user_id ON public.meeting_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_type ON public.meeting_minutes(meeting_type);
