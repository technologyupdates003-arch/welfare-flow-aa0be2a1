-- ============================================================================
-- WITHDRAWAL APPROVAL DIAGNOSTIC QUERIES
-- ============================================================================
-- Run these queries to diagnose why chairperson is not seeing withdrawals

-- ============================================================================
-- STEP 1: Check if withdrawals exist
-- ============================================================================

SELECT 
  'Total Withdrawals' as check_type,
  COUNT(*) as count
FROM public.penalty_withdrawals;

-- ============================================================================
-- STEP 2: Check withdrawal statuses
-- ============================================================================

SELECT 
  'Withdrawals by Status' as check_type,
  status,
  COUNT(*) as count
FROM public.penalty_withdrawals
GROUP BY status;

-- ============================================================================
-- STEP 3: Check signatories
-- ============================================================================

SELECT 
  'Total Signatories' as check_type,
  COUNT(*) as count
FROM public.withdrawal_signatories;

-- ============================================================================
-- STEP 4: Check signatories by role
-- ============================================================================

SELECT 
  'Signatories by Role' as check_type,
  signatory_role,
  COUNT(*) as count
FROM public.withdrawal_signatories
GROUP BY signatory_role;

-- ============================================================================
-- STEP 5: Check signatories by status
-- ============================================================================

SELECT 
  'Signatories by Status' as check_type,
  status,
  COUNT(*) as count
FROM public.withdrawal_signatories
GROUP BY status;

-- ============================================================================
-- STEP 6: Check if chairperson user exists
-- ============================================================================

SELECT 
  'Chairperson Users' as check_type,
  COUNT(*) as count
FROM public.user_roles
WHERE role = 'chairperson';

-- ============================================================================
-- STEP 7: Get chairperson user IDs
-- ============================================================================

SELECT 
  'Chairperson User IDs' as check_type,
  user_id,
  role
FROM public.user_roles
WHERE role = 'chairperson';

-- ============================================================================
-- STEP 8: Check if chairperson is assigned to any withdrawals
-- ============================================================================

SELECT 
  'Chairperson Signatory Assignments' as check_type,
  ws.id,
  ws.withdrawal_id,
  ws.signatory_role,
  ws.signatory_user_id,
  ws.status,
  ur.user_id as chairperson_user_id
FROM public.withdrawal_signatories ws
LEFT JOIN public.user_roles ur ON ur.user_id = ws.signatory_user_id AND ur.role = 'chairperson'
WHERE ws.signatory_role = 'chairperson';

-- ============================================================================
-- STEP 9: Check withdrawal details with signatories
-- ============================================================================

SELECT 
  'Withdrawals with Signatories' as check_type,
  pw.id,
  pw.amount,
  pw.status,
  ws.signatory_role,
  ws.status as signatory_status,
  ws.signatory_user_id
FROM public.penalty_withdrawals pw
LEFT JOIN public.withdrawal_signatories ws ON pw.id = ws.withdrawal_id
ORDER BY pw.created_at DESC;

-- ============================================================================
-- STEP 10: Check if RLS policies are enabled
-- ============================================================================

SELECT 
  'RLS Status' as check_type,
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('penalty_withdrawals', 'withdrawal_signatories');

-- ============================================================================
-- STEP 11: Check RLS policies
-- ============================================================================

SELECT 
  'RLS Policies' as check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('penalty_withdrawals', 'withdrawal_signatories')
ORDER BY tablename, policyname;

-- ============================================================================
-- TREASURER SPECIFIC DIAGNOSTIC QUERIES
-- ============================================================================
-- Run these queries to diagnose why treasurer is not seeing withdrawals

-- ============================================================================
-- TREASURER STEP 1: Check if treasurer users exist
-- ============================================================================

SELECT
  'Treasurer Users' as check_type,
  COUNT(*) as count
FROM public.user_roles
WHERE role = 'treasurer';

-- ============================================================================
-- TREASURER STEP 2: Get treasurer user IDs
-- ============================================================================

SELECT
  'Treasurer User IDs' as check_type,
  user_id,
  role
FROM public.user_roles
WHERE role = 'treasurer';

-- ============================================================================
-- TREASURER STEP 3: Check if treasurer is assigned to any withdrawals
-- ============================================================================

SELECT
  'Treasurer Signatory Assignments' as check_type,
  ws.id,
  ws.withdrawal_id,
  ws.signatory_role,
  ws.signatory_user_id,
  ws.status,
  ur.user_id as treasurer_user_id
FROM public.withdrawal_signatories ws
LEFT JOIN public.user_roles ur ON ur.user_id = ws.signatory_user_id AND ur.role = 'treasurer'
WHERE ws.signatory_role = 'treasurer';

-- ============================================================================
-- TREASURER STEP 4: Check treasurer pending approvals
-- ============================================================================

SELECT
  'Treasurer Pending Approvals' as check_type,
  pw.id,
  pw.amount,
  pw.reason,
  pw.status,
  ws.signatory_role,
  ws.status as signatory_status,
  ws.signatory_user_id
FROM public.penalty_withdrawals pw
LEFT JOIN public.withdrawal_signatories ws ON pw.id = ws.withdrawal_id
WHERE ws.signatory_role = 'treasurer'
AND ws.status = 'pending'
AND pw.status IN ('pending', 'submitted', 'approved');

-- ============================================================================
-- TREASURER STEP 5: Check what the treasurer dashboard query should return
-- ============================================================================
-- Replace 'TREASURER_USER_ID' with actual treasurer user ID

SELECT
  'Treasurer Should See' as check_type,
  pw.id,
  pw.amount,
  pw.reason,
  pw.status,
  ws.signatory_role,
  ws.status as signatory_status
FROM public.penalty_withdrawals pw
LEFT JOIN public.withdrawal_signatories ws ON pw.id = ws.withdrawal_id
WHERE ws.signatory_user_id = 'TREASURER_USER_ID'::uuid
AND ws.signatory_role = 'treasurer'
AND pw.status IN ('pending', 'submitted', 'approved');
  pw.reason,
  pw.status,
  ws.signatory_role,
  ws.status as signatory_status
FROM public.penalty_withdrawals pw
LEFT JOIN public.withdrawal_signatories ws ON pw.id = ws.withdrawal_id
WHERE ws.signatory_user_id = 'CHAIRPERSON_USER_ID'::uuid
AND ws.signatory_role = 'chairperson'
AND pw.status IN ('pending', 'submitted', 'approved');

-- ============================================================================
-- STEP 13: Check if chairperson has pending approvals
-- ============================================================================

SELECT 
  'Chairperson Pending Approvals' as check_type,
  pw.id,
  pw.amount,
  pw.reason,
  pw.status,
  ws.signatory_role,
  ws.status as signatory_status
FROM public.penalty_withdrawals pw
LEFT JOIN public.withdrawal_signatories ws ON pw.id = ws.withdrawal_id
WHERE ws.signatory_role = 'chairperson'
AND ws.status = 'pending'
AND pw.status IN ('pending', 'submitted');

-- ============================================================================
-- STEP 14: Check all users and their roles
-- ============================================================================

SELECT 
  'Users and Roles' as check_type,
  ur.user_id,
  ur.role,
  au.email
FROM public.user_roles ur
LEFT JOIN auth.users au ON ur.user_id = au.id
ORDER BY ur.role, ur.user_id;

-- ============================================================================
-- STEP 15: Check if withdrawal_signatories has correct user IDs
-- ============================================================================

SELECT 
  'Signatory User IDs' as check_type,
  ws.id,
  ws.withdrawal_id,
  ws.signatory_role,
  ws.signatory_user_id,
  ws.status,
  au.email
FROM public.withdrawal_signatories ws
LEFT JOIN auth.users au ON ws.signatory_user_id = au.id
ORDER BY ws.created_at DESC;

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT 
  'DIAGNOSTIC SUMMARY' as section,
  'Check the results above to identify the issue:' as note;

SELECT 
  'Possible Issues' as issue,
  'Solution' as solution
UNION ALL
SELECT 
  '1. No withdrawals exist',
  'Run migration: 20260512_withdrawal_approval_system.sql'
UNION ALL
SELECT 
  '2. No signatories assigned',
  'Check if withdrawal status is "submitted"'
UNION ALL
SELECT 
  '3. Chairperson not assigned to withdrawals',
  'Check if chairperson user ID matches in withdrawal_signatories'
UNION ALL
SELECT 
  '4. Chairperson user ID is NULL',
  'Check if chairperson user exists in auth.users'
UNION ALL
SELECT 
  '5. RLS policies blocking access',
  'Check if RLS is enabled and policies are correct'
UNION ALL
SELECT 
  '6. Withdrawal status not in (pending, submitted, approved)',
  'Check withdrawal status values';
