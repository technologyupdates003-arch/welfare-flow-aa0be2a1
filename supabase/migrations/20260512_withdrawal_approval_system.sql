-- ============================================================================
-- WITHDRAWAL APPROVAL SYSTEM - Data Migration & Test Setup
-- ============================================================================
-- This migration sets up the withdrawal approval workflow with:
-- 1. Sample withdrawal requests
-- 2. Signatory assignments (Chairperson, Secretary, Treasurer)
-- 3. Approval workflows
-- 4. B2C transaction tracking
-- 5. Receipt generation

-- ============================================================================
-- STEP 1: GET ADMIN AND SIGNATORY USER IDs
-- ============================================================================
-- NOTE: This migration requires actual user IDs from your auth.users table
-- You can find them by running:
-- SELECT id, email FROM auth.users;

-- IMPORTANT: Before running this migration, update the UUIDs below with real user IDs
-- Replace these placeholder UUIDs with actual IDs from your system:
-- ADMIN_ID = 'YOUR_ADMIN_USER_ID'
-- CHAIRPERSON_ID = 'YOUR_CHAIRPERSON_USER_ID'
-- SECRETARY_ID = 'YOUR_SECRETARY_USER_ID'
-- TREASURER_ID = 'YOUR_TREASURER_USER_ID'

-- For now, we'll use a helper to get the first admin user, or skip if none exist

-- ============================================================================
-- STEP 2: CREATE SAMPLE WITHDRAWAL REQUESTS (Only if admin users exist)
-- ============================================================================

-- Sample Withdrawal 1: Pending (No approvals yet)
-- Only insert if we have at least one admin user
DO $$
DECLARE
  admin_id UUID;
BEGIN
  -- Try to get an admin user
  SELECT id INTO admin_id FROM auth.users LIMIT 1;
  
  IF admin_id IS NOT NULL THEN
    INSERT INTO public.penalty_withdrawals (
      id,
      amount,
      reason,
      phone_number,
      requested_by,
      status,
      created_at,
      updated_at
    ) VALUES (
      '550e8400-e29b-41d4-a716-446655440100'::uuid,
      50000,
      'Monthly penalty collection withdrawal',
      '0712345678',
      admin_id,
      'pending',
      now(),
      now()
    ) ON CONFLICT DO NOTHING;
  ELSE
    RAISE WARNING 'No users found in auth.users table. Skipping withdrawal sample data.';
  END IF;
END $$;

-- Sample Withdrawal 2: Submitted (Awaiting approvals)
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM auth.users LIMIT 1;
  IF admin_id IS NOT NULL THEN
    INSERT INTO public.penalty_withdrawals (
      id,
      amount,
      reason,
      phone_number,
      requested_by,
      status,
      submitted_at,
      created_at,
      updated_at
    ) VALUES (
      '550e8400-e29b-41d4-a716-446655440101'::uuid,
      75000,
      'Quarterly penalty fund distribution',
      '0723456789',
      admin_id,
      'submitted',
      now(),
      now(),
      now()
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Sample Withdrawal 3: Partially Approved (1 approval)
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM auth.users LIMIT 1;
  IF admin_id IS NOT NULL THEN
    INSERT INTO public.penalty_withdrawals (
      id,
      amount,
      reason,
      phone_number,
      requested_by,
      status,
      submitted_at,
      created_at,
      updated_at
    ) VALUES (
      '550e8400-e29b-41d4-a716-446655440102'::uuid,
      100000,
      'Emergency fund withdrawal',
      '0734567890',
      admin_id,
      'submitted',
      now(),
      now(),
      now()
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Sample Withdrawal 4: Fully Approved (All 3 approved)
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM auth.users LIMIT 1;
  IF admin_id IS NOT NULL THEN
    INSERT INTO public.penalty_withdrawals (
      id,
      amount,
      reason,
      phone_number,
      requested_by,
      status,
      submitted_at,
      created_at,
      updated_at
    ) VALUES (
      '550e8400-e29b-41d4-a716-446655440103'::uuid,
      60000,
      'Previous approved withdrawal ready for B2C',
      '0745678901',
      admin_id,
      'approved',
      now(),
      now(),
      now()
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Sample Withdrawal 5: Rejected
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM auth.users LIMIT 1;
  IF admin_id IS NOT NULL THEN
    INSERT INTO public.penalty_withdrawals (
      id,
      amount,
      reason,
      phone_number,
      requested_by,
      status,
      submitted_at,
      created_at,
      updated_at
    ) VALUES (
      '550e8400-e29b-41d4-a716-446655440104'::uuid,
      30000,
      'Rejected withdrawal request',
      '0756789012',
      admin_id,
      'rejected',
      now(),
      now(),
      now()
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Sample Withdrawal 6: Completed (B2C transferred)
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM auth.users LIMIT 1;
  IF admin_id IS NOT NULL THEN
    INSERT INTO public.penalty_withdrawals (
      id,
      amount,
      reason,
      phone_number,
      requested_by,
      status,
      submitted_at,
      completed_at,
      created_at,
      updated_at
    ) VALUES (
      '550e8400-e29b-41d4-a716-446655440105'::uuid,
      45000,
      'Successfully completed withdrawal',
      '0767890123',
      admin_id,
      'completed',
      now() - interval '1 day',
      now(),
      now() - interval '1 day',
      now()
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: ASSIGN SIGNATORIES TO WITHDRAWALS
-- ============================================================================

-- Withdrawal 1: Pending - No signatories yet (will be assigned when submitted)

-- Withdrawal 2: Submitted - All 3 signatories pending
DO $$
DECLARE
  chairperson_id UUID;
  secretary_id UUID;
  treasurer_id UUID;
BEGIN
  SELECT id INTO chairperson_id FROM auth.users LIMIT 1;
  SELECT id INTO secretary_id FROM auth.users OFFSET 1 LIMIT 1;
  SELECT id INTO treasurer_id FROM auth.users OFFSET 2 LIMIT 1;
  
  IF chairperson_id IS NOT NULL THEN
    INSERT INTO public.withdrawal_signatories (
      withdrawal_id,
      signatory_role,
      signatory_user_id,
      status,
      created_at,
      updated_at
    ) VALUES 
      (
        '550e8400-e29b-41d4-a716-446655440101'::uuid,
        'chairperson',
        chairperson_id,
        'pending',
        now(),
        now()
      )
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF secretary_id IS NOT NULL THEN
    INSERT INTO public.withdrawal_signatories (
      withdrawal_id,
      signatory_role,
      signatory_user_id,
      status,
      created_at,
      updated_at
    ) VALUES 
      (
        '550e8400-e29b-41d4-a716-446655440101'::uuid,
        'secretary',
        secretary_id,
        'pending',
        now(),
        now()
      )
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF treasurer_id IS NOT NULL THEN
    INSERT INTO public.withdrawal_signatories (
      withdrawal_id,
      signatory_role,
      signatory_user_id,
      status,
      created_at,
      updated_at
    ) VALUES 
      (
        '550e8400-e29b-41d4-a716-446655440101'::uuid,
        'treasurer',
        treasurer_id,
        'pending',
        now(),
        now()
      )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Withdrawal 3: Partially Approved - Chairperson approved, others pending
DO $$
DECLARE
  chairperson_id UUID;
  secretary_id UUID;
  treasurer_id UUID;
BEGIN
  SELECT id INTO chairperson_id FROM auth.users LIMIT 1;
  SELECT id INTO secretary_id FROM auth.users OFFSET 1 LIMIT 1;
  SELECT id INTO treasurer_id FROM auth.users OFFSET 2 LIMIT 1;
  
  IF chairperson_id IS NOT NULL THEN
    INSERT INTO public.withdrawal_signatories (
      withdrawal_id,
      signatory_role,
      signatory_user_id,
      status,
      approved_at,
      created_at,
      updated_at
    ) VALUES 
      (
        '550e8400-e29b-41d4-a716-446655440102'::uuid,
        'chairperson',
        chairperson_id,
        'approved',
        now() - interval '2 hours',
        now() - interval '2 hours',
        now() - interval '2 hours'
      )
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF secretary_id IS NOT NULL THEN
    INSERT INTO public.withdrawal_signatories (
      withdrawal_id,
      signatory_role,
      signatory_user_id,
      status,
      created_at,
      updated_at
    ) VALUES 
      (
        '550e8400-e29b-41d4-a716-446655440102'::uuid,
        'secretary',
        secretary_id,
        'pending',
        now(),
        now()
      )
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF treasurer_id IS NOT NULL THEN
    INSERT INTO public.withdrawal_signatories (
      withdrawal_id,
      signatory_role,
      signatory_user_id,
      status,
      created_at,
      updated_at
    ) VALUES 
      (
        '550e8400-e29b-41d4-a716-446655440102'::uuid,
        'treasurer',
        treasurer_id,
        'pending',
        now(),
        now()
      )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Withdrawal 4: Fully Approved - All 3 approved
DO $$
DECLARE
  chairperson_id UUID;
  secretary_id UUID;
  treasurer_id UUID;
BEGIN
  SELECT id INTO chairperson_id FROM auth.users LIMIT 1;
  SELECT id INTO secretary_id FROM auth.users OFFSET 1 LIMIT 1;
  SELECT id INTO treasurer_id FROM auth.users OFFSET 2 LIMIT 1;
  
  IF chairperson_id IS NOT NULL THEN
    INSERT INTO public.withdrawal_signatories (
      withdrawal_id,
      signatory_role,
      signatory_user_id,
      status,
      approved_at,
      created_at,
      updated_at
    ) VALUES 
      (
        '550e8400-e29b-41d4-a716-446655440103'::uuid,
        'chairperson',
        chairperson_id,
        'approved',
        now() - interval '4 hours',
        now() - interval '4 hours',
        now() - interval '4 hours'
      )
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF secretary_id IS NOT NULL THEN
    INSERT INTO public.withdrawal_signatories (
      withdrawal_id,
      signatory_role,
      signatory_user_id,
      status,
      approved_at,
      created_at,
      updated_at
    ) VALUES 
      (
        '550e8400-e29b-41d4-a716-446655440103'::uuid,
        'secretary',
        secretary_id,
        'approved',
        now() - interval '3 hours',
        now() - interval '3 hours',
        now() - interval '3 hours'
      )
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF treasurer_id IS NOT NULL THEN
    INSERT INTO public.withdrawal_signatories (
      withdrawal_id,
      signatory_role,
      signatory_user_id,
      status,
      approved_at,
      created_at,
      updated_at
    ) VALUES 
      (
        '550e8400-e29b-41d4-a716-446655440103'::uuid,
        'treasurer',
        treasurer_id,
        'approved',
        now() - interval '2 hours',
        now() - interval '2 hours',
        now() - interval '2 hours'
      )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Withdrawal 5: Rejected - Secretary rejected
DO $$
DECLARE
  chairperson_id UUID;
  secretary_id UUID;
  treasurer_id UUID;
BEGIN
  SELECT id INTO chairperson_id FROM auth.users LIMIT 1;
  SELECT id INTO secretary_id FROM auth.users OFFSET 1 LIMIT 1;
  SELECT id INTO treasurer_id FROM auth.users OFFSET 2 LIMIT 1;
  
  IF chairperson_id IS NOT NULL THEN
    INSERT INTO public.withdrawal_signatories (
      withdrawal_id,
      signatory_role,
      signatory_user_id,
      status,
      approved_at,
      created_at,
      updated_at
    ) VALUES 
      (
        '550e8400-e29b-41d4-a716-446655440104'::uuid,
        'chairperson',
        chairperson_id,
        'approved',
        now() - interval '3 hours',
        now() - interval '3 hours',
        now() - interval '3 hours'
      )
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF secretary_id IS NOT NULL THEN
    INSERT INTO public.withdrawal_signatories (
      withdrawal_id,
      signatory_role,
      signatory_user_id,
      status,
      created_at,
      updated_at
    ) VALUES 
      (
        '550e8400-e29b-41d4-a716-446655440104'::uuid,
        'secretary',
        secretary_id,
        'rejected',
        now() - interval '2 hours',
        now() - interval '2 hours'
      )
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF treasurer_id IS NOT NULL THEN
    INSERT INTO public.withdrawal_signatories (
      withdrawal_id,
      signatory_role,
      signatory_user_id,
      status,
      created_at,
      updated_at
    ) VALUES 
      (
        '550e8400-e29b-41d4-a716-446655440104'::uuid,
        'treasurer',
        treasurer_id,
        'pending',
        now(),
        now()
      )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Withdrawal 6: Completed - All approved and B2C transferred
DO $$
DECLARE
  chairperson_id UUID;
  secretary_id UUID;
  treasurer_id UUID;
BEGIN
  SELECT id INTO chairperson_id FROM auth.users LIMIT 1;
  SELECT id INTO secretary_id FROM auth.users OFFSET 1 LIMIT 1;
  SELECT id INTO treasurer_id FROM auth.users OFFSET 2 LIMIT 1;
  
  IF chairperson_id IS NOT NULL THEN
    INSERT INTO public.withdrawal_signatories (
      withdrawal_id,
      signatory_role,
      signatory_user_id,
      status,
      approved_at,
      created_at,
      updated_at
    ) VALUES 
      (
        '550e8400-e29b-41d4-a716-446655440105'::uuid,
        'chairperson',
        chairperson_id,
        'approved',
        now() - interval '1 day' - interval '3 hours',
        now() - interval '1 day' - interval '3 hours',
        now() - interval '1 day' - interval '3 hours'
      )
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF secretary_id IS NOT NULL THEN
    INSERT INTO public.withdrawal_signatories (
      withdrawal_id,
      signatory_role,
      signatory_user_id,
      status,
      approved_at,
      created_at,
      updated_at
    ) VALUES 
      (
        '550e8400-e29b-41d4-a716-446655440105'::uuid,
        'secretary',
        secretary_id,
        'approved',
        now() - interval '1 day' - interval '2 hours',
        now() - interval '1 day' - interval '2 hours',
        now() - interval '1 day' - interval '2 hours'
      )
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF treasurer_id IS NOT NULL THEN
    INSERT INTO public.withdrawal_signatories (
      withdrawal_id,
      signatory_role,
      signatory_user_id,
      status,
      approved_at,
      created_at,
      updated_at
    ) VALUES 
      (
        '550e8400-e29b-41d4-a716-446655440105'::uuid,
        'treasurer',
        treasurer_id,
        'approved',
        now() - interval '1 day' - interval '1 hour',
        now() - interval '1 day' - interval '1 hour',
        now() - interval '1 day' - interval '1 hour'
      )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: CREATE B2C TRANSACTIONS FOR COMPLETED WITHDRAWALS
-- ============================================================================

INSERT INTO public.b2c_transactions (
  id,
  withdrawal_id,
  mpesa_transaction_id,
  phone_number,
  amount,
  status,
  initiated_at,
  completed_at,
  created_at,
  updated_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440200'::uuid,
  '550e8400-e29b-41d4-a716-446655440105'::uuid,
  'BL123456789',
  '0767890123',
  45000,
  'completed',
  now() - interval '1 day' - interval '30 minutes',
  now() - interval '1 day',
  now() - interval '1 day',
  now() - interval '1 day'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 5: CREATE WITHDRAWAL RECEIPTS
-- ============================================================================

INSERT INTO public.withdrawal_receipts (
  id,
  withdrawal_id,
  receipt_pdf_url,
  generated_at,
  created_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440300'::uuid,
  '550e8400-e29b-41d4-a716-446655440105'::uuid,
  'https://storage.supabase.co/receipts/withdrawal_550e8400-e29b-41d4-a716-446655440105.pdf',
  now() - interval '1 day',
  now() - interval '1 day'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 6: VERIFICATION QUERIES
-- ============================================================================

-- Check all withdrawals
SELECT 
  'Withdrawals Created' as check_type,
  COUNT(*) as total_withdrawals,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
FROM public.penalty_withdrawals;

-- Check signatories
SELECT 
  'Signatories Assigned' as check_type,
  COUNT(*) as total_signatories,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
FROM public.withdrawal_signatories;

-- Check B2C transactions
SELECT 
  'B2C Transactions' as check_type,
  COUNT(*) as total_transactions,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM public.b2c_transactions;

-- Check receipts
SELECT 
  'Receipts Generated' as check_type,
  COUNT(*) as total_receipts
FROM public.withdrawal_receipts;

-- ============================================================================
-- STEP 7: DETAILED WITHDRAWAL STATUS REPORT
-- ============================================================================

SELECT 
  pw.id,
  pw.amount,
  pw.reason,
  pw.phone_number,
  pw.status,
  pw.submitted_at,
  pw.completed_at,
  COUNT(CASE WHEN ws.status = 'approved' THEN 1 END) as approvals_count,
  COUNT(CASE WHEN ws.status = 'rejected' THEN 1 END) as rejections_count,
  STRING_AGG(DISTINCT ws.signatory_role || ':' || ws.status, ', ') as signatory_status
FROM public.penalty_withdrawals pw
LEFT JOIN public.withdrawal_signatories ws ON pw.id = ws.withdrawal_id
GROUP BY pw.id, pw.amount, pw.reason, pw.phone_number, pw.status, pw.submitted_at, pw.completed_at
ORDER BY pw.created_at DESC;

-- ============================================================================
-- STEP 8: APPROVAL WORKFLOW STATUS
-- ============================================================================

-- Show pending approvals for each signatory role
SELECT 
  'Pending Approvals by Role' as report_type,
  ws.signatory_role,
  COUNT(*) as pending_count,
  STRING_AGG(pw.reason, ', ') as withdrawal_reasons
FROM public.withdrawal_signatories ws
JOIN public.penalty_withdrawals pw ON ws.withdrawal_id = pw.id
WHERE ws.status = 'pending' AND pw.status IN ('submitted', 'approved')
GROUP BY ws.signatory_role;

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================

SELECT 
  'Withdrawal Approval System Setup Complete' as status,
  'Sample data created for testing all approval workflows' as message,
  now() as completed_at;
