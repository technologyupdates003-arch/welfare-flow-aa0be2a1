-- ============================================================================
-- SIGNATORY SIGNATURES TABLE
-- ============================================================================
-- This migration creates a table for storing signatory signatures
-- Each signatory (chairperson, secretary, treasurer) can upload their signature
-- Signatures are prefilled on withdrawal receipts when they approve

-- ============================================================================
-- STEP 1: CREATE SIGNATORY SIGNATURES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.signatory_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signatory_role TEXT NOT NULL CHECK (signatory_role IN ('chairperson', 'secretary', 'treasurer')),
  signature_url TEXT,
  full_name TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, signatory_role)
);

-- ============================================================================
-- STEP 2: ENABLE RLS
-- ============================================================================

ALTER TABLE public.signatory_signatures ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: CREATE RLS POLICIES
-- ============================================================================

-- Signatories can view their own signature
CREATE POLICY "Signatories can view own signature"
ON public.signatory_signatures FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Signatories can update their own signature
CREATE POLICY "Signatories can update own signature"
ON public.signatory_signatures FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Signatories can insert their own signature
CREATE POLICY "Signatories can insert own signature"
ON public.signatory_signatures FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Admin can view all signatures
CREATE POLICY "Admin can view all signatures"
ON public.signatory_signatures FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Admin can update all signatures
CREATE POLICY "Admin can update all signatures"
ON public.signatory_signatures FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- ============================================================================
-- STEP 4: CREATE INDEXES
-- ============================================================================

CREATE INDEX idx_signatory_signatures_user_id ON public.signatory_signatures(user_id);
CREATE INDEX idx_signatory_signatures_signatory_role ON public.signatory_signatures(signatory_role);
CREATE INDEX idx_signatory_signatures_user_role ON public.signatory_signatures(user_id, signatory_role);

-- ============================================================================
-- STEP 5: VERIFICATION
-- ============================================================================

SELECT 
  'Signatory Signatures Table Created' as status,
  'Ready for signature uploads' as message,
  now() as completed_at;

-- Verify table exists
SELECT 
  'Table Verification' as check_type,
  COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'signatory_signatures';

-- Verify RLS enabled
SELECT 
  'RLS Status' as check_type,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'signatory_signatures';

-- Verify indexes created
SELECT 
  'Indexes Created' as check_type,
  COUNT(*) as count
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename = 'signatory_signatures';
