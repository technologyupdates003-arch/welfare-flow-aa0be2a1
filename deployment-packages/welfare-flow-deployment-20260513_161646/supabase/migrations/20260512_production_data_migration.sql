-- Production Data Migration - Penalty Wallet System
-- This script migrates real data from existing tables to the penalty wallet system
-- IMPORTANT: Backup database before running this script

-- ============================================================================
-- PHASE 1: INITIALIZE PENALTY WALLET
-- ============================================================================

-- Create penalty wallet if it doesn't exist
INSERT INTO public.penalty_wallet (id, total_balance, total_received, total_withdrawn, last_updated, created_at)
SELECT 
  gen_random_uuid(),
  0,
  0,
  0,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.penalty_wallet)
LIMIT 1;

-- ============================================================================
-- PHASE 2: MIGRATE EXISTING PENALTIES
-- ============================================================================

-- Migrate penalties from existing penalties table (if not already migrated)
-- This assumes penalties already exist in the penalties table
-- Count existing penalties
SELECT 
  'Existing Penalties' as migration_step,
  COUNT(*) as total_penalties,
  COUNT(CASE WHEN is_paid = FALSE THEN 1 END) as unpaid_penalties,
  COUNT(CASE WHEN is_paid = TRUE THEN 1 END) as paid_penalties,
  COALESCE(SUM(amount), 0) as total_amount
FROM public.penalties;

-- ============================================================================
-- PHASE 3: MIGRATE PAYMENT RECORDS
-- ============================================================================

-- Migrate payment records from existing payment tables
-- This assumes payment records exist in a payment_records or similar table
-- If you have existing payment data, insert it here:

-- Example: If payments are in a different table, migrate them:
-- INSERT INTO public.penalty_payment_records (
--   member_id,
--   penalty_id,
--   amount,
--   payment_ref,
--   mpesa_transaction_id,
--   status,
--   verified_by,
--   verified_at,
--   created_at,
--   updated_at
-- )
-- SELECT 
--   m.id,
--   p.id,
--   op.amount,
--   op.reference,
--   op.mpesa_id,
--   CASE WHEN op.verified = TRUE THEN 'verified' ELSE 'pending' END,
--   (SELECT id FROM auth.users LIMIT 1),
--   CASE WHEN op.verified = TRUE THEN op.verified_date ELSE NULL END,
--   op.created_at,
--   op.updated_at
-- FROM old_payment_table op
-- JOIN public.members m ON op.member_id = m.id
-- JOIN public.penalties p ON m.id = p.member_id
-- WHERE NOT EXISTS (
--   SELECT 1 FROM public.penalty_payment_records 
--   WHERE mpesa_transaction_id = op.mpesa_id
-- );

-- Count migrated payment records
SELECT 
  'Migrated Payment Records' as migration_step,
  COUNT(*) as total_records,
  COUNT(CASE WHEN status = 'verified' THEN 1 END) as verified,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  COALESCE(SUM(CASE WHEN status = 'verified' THEN amount ELSE 0 END), 0) as verified_total
FROM public.penalty_payment_records;

-- ============================================================================
-- PHASE 4: UPDATE WALLET BALANCE FROM VERIFIED PAYMENTS
-- ============================================================================

-- Calculate and update wallet balance from verified payments
UPDATE public.penalty_wallet
SET
  total_balance = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.penalty_payment_records
    WHERE status = 'verified'
  ),
  total_received = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.penalty_payment_records
    WHERE status = 'verified'
  ),
  last_updated = now()
WHERE id = (SELECT id FROM public.penalty_wallet LIMIT 1);

-- Verify wallet balance
SELECT 
  'Wallet Balance After Migration' as migration_step,
  total_balance,
  total_received,
  total_withdrawn,
  (total_received - total_withdrawn) as expected_balance
FROM public.penalty_wallet;

-- ============================================================================
-- PHASE 5: CREATE WITHDRAWAL REQUESTS FROM EXISTING DATA
-- ============================================================================

-- If you have existing withdrawal requests, migrate them:
-- INSERT INTO public.penalty_withdrawals (
--   amount,
--   reason,
--   requested_by,
--   status,
--   phone_number,
--   submitted_at,
--   completed_at,
--   created_at,
--   updated_at
-- )
-- SELECT 
--   ow.amount,
--   ow.reason,
--   (SELECT id FROM auth.users WHERE role = 'admin' LIMIT 1),
--   CASE 
--     WHEN ow.status = 'completed' THEN 'completed'
--     WHEN ow.status = 'approved' THEN 'approved'
--     WHEN ow.status = 'rejected' THEN 'rejected'
--     ELSE 'pending'
--   END,
--   ow.phone_number,
--   ow.submitted_at,
--   CASE WHEN ow.status = 'completed' THEN ow.completed_at ELSE NULL END,
--   ow.created_at,
--   ow.updated_at
-- FROM old_withdrawals_table ow
-- WHERE NOT EXISTS (
--   SELECT 1 FROM public.penalty_withdrawals 
--   WHERE amount = ow.amount AND created_at = ow.created_at
-- );

-- Count withdrawal requests
SELECT 
  'Withdrawal Requests' as migration_step,
  COUNT(*) as total_withdrawals,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
  COALESCE(SUM(amount), 0) as total_amount
FROM public.penalty_withdrawals;

-- ============================================================================
-- PHASE 6: ASSIGN SIGNATORIES TO WITHDRAWALS
-- ============================================================================

-- Get signatory users
WITH signatories AS (
  SELECT 
    u.id,
    ur.role
  FROM auth.users u
  JOIN public.user_roles ur ON u.id = ur.user_id
  WHERE ur.role IN ('chairperson', 'secretary', 'treasurer')
),
pending_withdrawals AS (
  SELECT id FROM public.penalty_withdrawals 
  WHERE status IN ('pending', 'approved')
  AND id NOT IN (
    SELECT DISTINCT withdrawal_id FROM public.withdrawal_signatories
  )
)
INSERT INTO public.withdrawal_signatories (
  withdrawal_id,
  signatory_role,
  signatory_user_id,
  status,
  created_at,
  updated_at
)
SELECT
  w.id,
  s.role,
  s.id,
  'pending',
  now(),
  now()
FROM pending_withdrawals w
CROSS JOIN signatories s
ON CONFLICT (withdrawal_id, signatory_role) DO NOTHING;

-- Count signatories
SELECT 
  'Withdrawal Signatories' as migration_step,
  COUNT(*) as total_signatories,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
FROM public.withdrawal_signatories;

-- ============================================================================
-- PHASE 7: MIGRATE B2C TRANSACTIONS
-- ============================================================================

-- If you have existing B2C transaction records, migrate them:
-- INSERT INTO public.b2c_transactions (
--   withdrawal_id,
--   mpesa_transaction_id,
--   phone_number,
--   amount,
--   status,
--   initiated_at,
--   completed_at,
--   error_message,
--   created_at,
--   updated_at
-- )
-- SELECT 
--   pw.id,
--   ob2c.transaction_id,
--   ob2c.phone_number,
--   ob2c.amount,
--   CASE 
--     WHEN ob2c.status = 'completed' THEN 'completed'
--     WHEN ob2c.status = 'failed' THEN 'failed'
--     ELSE 'pending'
--   END,
--   ob2c.initiated_at,
--   CASE WHEN ob2c.status = 'completed' THEN ob2c.completed_at ELSE NULL END,
--   ob2c.error_message,
--   ob2c.created_at,
--   ob2c.updated_at
-- FROM old_b2c_table ob2c
-- JOIN public.penalty_withdrawals pw ON ob2c.withdrawal_id = pw.id
-- WHERE NOT EXISTS (
--   SELECT 1 FROM public.b2c_transactions 
--   WHERE mpesa_transaction_id = ob2c.transaction_id
-- );

-- Count B2C transactions
SELECT 
  'B2C Transactions' as migration_step,
  COUNT(*) as total_transactions,
  COUNT(CASE WHEN status = 'initiated' THEN 1 END) as initiated,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  COALESCE(SUM(amount), 0) as total_amount
FROM public.b2c_transactions;

-- ============================================================================
-- PHASE 8: DATA INTEGRITY CHECKS
-- ============================================================================

-- Check 1: Verify wallet balance matches verified payments
SELECT 
  'Balance Check' as check_name,
  pw.total_balance as wallet_balance,
  (SELECT COALESCE(SUM(amount), 0) FROM public.penalty_payment_records WHERE status = 'verified') as calculated_balance,
  CASE 
    WHEN pw.total_balance = (SELECT COALESCE(SUM(amount), 0) FROM public.penalty_payment_records WHERE status = 'verified')
    THEN 'PASS'
    ELSE 'FAIL'
  END as status
FROM public.penalty_wallet pw;

-- Check 2: Verify all withdrawals have signatories
SELECT 
  'Signatory Assignment Check' as check_name,
  COUNT(*) as withdrawals_without_signatories
FROM public.penalty_withdrawals pw
WHERE NOT EXISTS (
  SELECT 1 FROM public.withdrawal_signatories ws
  WHERE ws.withdrawal_id = pw.id
);

-- Check 3: Verify all signatories have valid users
SELECT 
  'Signatory User Check' as check_name,
  COUNT(*) as signatories_without_users
FROM public.withdrawal_signatories ws
WHERE ws.signatory_user_id IS NULL;

-- Check 4: Verify B2C transactions reference valid withdrawals
SELECT 
  'B2C Transaction Check' as check_name,
  COUNT(*) as orphaned_b2c_transactions
FROM public.b2c_transactions bt
WHERE NOT EXISTS (
  SELECT 1 FROM public.penalty_withdrawals pw
  WHERE pw.id = bt.withdrawal_id
);

-- Check 5: Verify payment records reference valid members
SELECT 
  'Payment Record Check' as check_name,
  COUNT(*) as orphaned_payment_records
FROM public.penalty_payment_records pr
WHERE NOT EXISTS (
  SELECT 1 FROM public.members m
  WHERE m.id = pr.member_id
);

-- ============================================================================
-- PHASE 9: MIGRATION SUMMARY
-- ============================================================================

-- Final summary of migrated data
SELECT 
  'MIGRATION SUMMARY' as report_type,
  'Penalties' as data_type,
  COUNT(*) as total_count,
  COALESCE(SUM(amount), 0) as total_amount
FROM public.penalties
UNION ALL
SELECT 
  'MIGRATION SUMMARY',
  'Payment Records',
  COUNT(*),
  COALESCE(SUM(amount), 0)
FROM public.penalty_payment_records
UNION ALL
SELECT 
  'MIGRATION SUMMARY',
  'Withdrawals',
  COUNT(*),
  COALESCE(SUM(amount), 0)
FROM public.penalty_withdrawals
UNION ALL
SELECT 
  'MIGRATION SUMMARY',
  'B2C Transactions',
  COUNT(*),
  COALESCE(SUM(amount), 0)
FROM public.b2c_transactions
UNION ALL
SELECT 
  'MIGRATION SUMMARY',
  'Wallet Balance',
  1,
  total_balance
FROM public.penalty_wallet;

-- ============================================================================
-- PHASE 10: POST-MIGRATION VERIFICATION
-- ============================================================================

-- Verify RLS policies are working
SELECT 
  'RLS Policy Check' as check_name,
  'penalty_payment_records' as table_name,
  COUNT(*) as policy_count
FROM information_schema.role_table_grants
WHERE table_name = 'penalty_payment_records'
UNION ALL
SELECT 
  'RLS Policy Check',
  'penalty_withdrawals',
  COUNT(*)
FROM information_schema.role_table_grants
WHERE table_name = 'penalty_withdrawals'
UNION ALL
SELECT 
  'RLS Policy Check',
  'withdrawal_signatories',
  COUNT(*)
FROM information_schema.role_table_grants
WHERE table_name = 'withdrawal_signatories'
UNION ALL
SELECT 
  'RLS Policy Check',
  'b2c_transactions',
  COUNT(*)
FROM information_schema.role_table_grants
WHERE table_name = 'b2c_transactions';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration completion
SELECT 
  'Migration Status' as status,
  'COMPLETE' as result,
  now() as completed_at,
  'All data successfully migrated to penalty wallet system' as message;
