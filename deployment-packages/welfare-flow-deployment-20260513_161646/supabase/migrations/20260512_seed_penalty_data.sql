-- Penalty Wallet System - Data Migration & Seeding
-- This script populates sample data for testing the penalty wallet system

-- ============================================================================
-- 1. INITIALIZE PENALTY WALLET
-- ============================================================================

-- Insert the main penalty wallet (singleton)
INSERT INTO public.penalty_wallet (id, total_balance, total_received, total_withdrawn, last_updated, created_at)
VALUES (
  gen_random_uuid(),
  0,
  0,
  0,
  now(),
  now()
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. SEED SAMPLE PENALTIES FOR MEMBERS
-- ============================================================================

-- Get sample members (assuming they exist in the members table)
-- This creates penalties for existing members
INSERT INTO public.penalties (member_id, amount, reason, is_paid, created_at, updated_at)
SELECT 
  m.id,
  (RANDOM() * 5000 + 1000)::NUMERIC,
  CASE (RANDOM() * 4)::INT
    WHEN 0 THEN 'Late contribution payment'
    WHEN 1 THEN 'Absence from meeting'
    WHEN 2 THEN 'Non-compliance with rules'
    WHEN 3 THEN 'Unauthorized withdrawal'
    ELSE 'Other violation'
  END,
  FALSE,
  now() - (RANDOM() * INTERVAL '90 days'),
  now()
FROM public.members m
WHERE m.id IN (
  SELECT id FROM public.members LIMIT 10
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. SEED SAMPLE PENALTY PAYMENT RECORDS
-- ============================================================================

-- Create sample payment records (some verified, some pending)
INSERT INTO public.penalty_payment_records (
  member_id,
  penalty_id,
  amount,
  payment_ref,
  mpesa_transaction_id,
  status,
  verified_by,
  verified_at,
  created_at,
  updated_at
)
SELECT
  m.id,
  p.id,
  p.amount,
  'PAY-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(ROW_NUMBER() OVER (ORDER BY m.id)::TEXT, 5, '0'),
  'MPesa' || LPAD((RANDOM() * 1000000)::INT::TEXT, 8, '0'),
  CASE (RANDOM() * 2)::INT
    WHEN 0 THEN 'verified'
    WHEN 1 THEN 'pending'
    ELSE 'failed'
  END,
  (SELECT id FROM auth.users LIMIT 1),
  CASE WHEN (RANDOM() * 2)::INT = 0 THEN now() - INTERVAL '5 days' ELSE NULL END,
  now() - (RANDOM() * INTERVAL '30 days'),
  now()
FROM public.members m
JOIN public.penalties p ON m.id = p.member_id
WHERE p.is_paid = FALSE
LIMIT 15
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. UPDATE PENALTY WALLET BALANCE FROM VERIFIED PAYMENTS
-- ============================================================================

-- Update wallet balance based on verified payments
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

-- ============================================================================
-- 5. SEED SAMPLE WITHDRAWAL REQUESTS
-- ============================================================================

-- Get admin user for withdrawal requests
WITH admin_user AS (
  SELECT u.id
  FROM auth.users u
  JOIN public.user_roles ur ON u.id = ur.user_id
  WHERE ur.role = 'admin'
  LIMIT 1
),
wallet_data AS (
  SELECT id, total_balance FROM public.penalty_wallet LIMIT 1
)
INSERT INTO public.penalty_withdrawals (
  amount,
  reason,
  requested_by,
  status,
  phone_number,
  submitted_at,
  completed_at,
  created_at,
  updated_at
)
SELECT
  CASE (ROW_NUMBER() OVER (ORDER BY RANDOM()))
    WHEN 1 THEN 5000
    WHEN 2 THEN 8000
    WHEN 3 THEN 3000
    ELSE 2000
  END,
  CASE (ROW_NUMBER() OVER (ORDER BY RANDOM()))
    WHEN 1 THEN 'Office supplies and equipment'
    WHEN 2 THEN 'Staff allowance and incentives'
    WHEN 3 THEN 'Building maintenance and repairs'
    ELSE 'Administrative expenses'
  END,
  (SELECT id FROM admin_user),
  CASE (ROW_NUMBER() OVER (ORDER BY RANDOM()))
    WHEN 1 THEN 'completed'
    WHEN 2 THEN 'approved'
    WHEN 3 THEN 'pending'
    ELSE 'pending'
  END,
  '0712' || LPAD((RANDOM() * 1000000)::INT::TEXT, 6, '0'),
  CASE WHEN (ROW_NUMBER() OVER (ORDER BY RANDOM())) <= 2 THEN now() - INTERVAL '10 days' ELSE NULL END,
  CASE WHEN (ROW_NUMBER() OVER (ORDER BY RANDOM())) = 1 THEN now() - INTERVAL '5 days' ELSE NULL END,
  now() - (RANDOM() * INTERVAL '30 days'),
  now()
FROM generate_series(1, 4)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. SEED WITHDRAWAL SIGNATORIES
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
withdrawals_to_sign AS (
  SELECT id FROM public.penalty_withdrawals LIMIT 4
)
INSERT INTO public.withdrawal_signatories (
  withdrawal_id,
  signatory_role,
  signatory_user_id,
  status,
  approved_at,
  rejected_at,
  created_at,
  updated_at
)
SELECT
  w.id,
  s.role,
  s.id,
  CASE 
    WHEN w.id = (SELECT id FROM withdrawals_to_sign ORDER BY id DESC LIMIT 1) THEN 'pending'
    WHEN w.id = (SELECT id FROM withdrawals_to_sign ORDER BY id DESC LIMIT 1 OFFSET 1) THEN 'approved'
    ELSE 'approved'
  END,
  CASE 
    WHEN w.id = (SELECT id FROM withdrawals_to_sign ORDER BY id DESC LIMIT 1) THEN NULL
    ELSE now() - INTERVAL '2 days'
  END,
  NULL,
  now() - INTERVAL '3 days',
  now()
FROM withdrawals_to_sign w
CROSS JOIN signatories s
ON CONFLICT (withdrawal_id, signatory_role) DO NOTHING;

-- ============================================================================
-- 7. SEED B2C TRANSACTIONS
-- ============================================================================

-- Create sample B2C transaction records
INSERT INTO public.b2c_transactions (
  withdrawal_id,
  mpesa_transaction_id,
  phone_number,
  amount,
  status,
  initiated_at,
  completed_at,
  created_at,
  updated_at
)
SELECT
  w.id,
  'B2C' || TO_CHAR(now(), 'YYYYMMDD') || LPAD((RANDOM() * 1000000)::INT::TEXT, 8, '0'),
  w.phone_number,
  w.amount,
  CASE (ROW_NUMBER() OVER (ORDER BY w.id))
    WHEN 1 THEN 'completed'
    WHEN 2 THEN 'pending'
    ELSE 'initiated'
  END,
  now() - INTERVAL '5 days',
  CASE WHEN (ROW_NUMBER() OVER (ORDER BY w.id)) = 1 THEN now() - INTERVAL '4 days' ELSE NULL END,
  now() - INTERVAL '5 days',
  now()
FROM public.penalty_withdrawals w
WHERE w.status IN ('completed', 'approved')
LIMIT 3
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 8. VERIFY DATA INTEGRITY
-- ============================================================================

-- Check penalty wallet balance
SELECT 
  'Penalty Wallet Status' as check_name,
  COUNT(*) as wallet_count,
  SUM(total_balance) as total_balance,
  SUM(total_received) as total_received,
  SUM(total_withdrawn) as total_withdrawn
FROM public.penalty_wallet;

-- Check penalties created
SELECT 
  'Penalties Created' as check_name,
  COUNT(*) as total_penalties,
  COUNT(CASE WHEN is_paid = FALSE THEN 1 END) as unpaid_penalties,
  COUNT(CASE WHEN is_paid = TRUE THEN 1 END) as paid_penalties,
  COALESCE(SUM(amount), 0) as total_amount
FROM public.penalties;

-- Check payment records
SELECT 
  'Payment Records' as check_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN status = 'verified' THEN 1 END) as verified,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  COALESCE(SUM(CASE WHEN status = 'verified' THEN amount ELSE 0 END), 0) as verified_amount
FROM public.penalty_payment_records;

-- Check withdrawals
SELECT 
  'Withdrawals' as check_name,
  COUNT(*) as total_withdrawals,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
  COALESCE(SUM(amount), 0) as total_amount
FROM public.penalty_withdrawals;

-- Check signatories
SELECT 
  'Signatories' as check_name,
  COUNT(*) as total_signatories,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
FROM public.withdrawal_signatories;

-- Check B2C transactions
SELECT 
  'B2C Transactions' as check_name,
  COUNT(*) as total_transactions,
  COUNT(CASE WHEN status = 'initiated' THEN 1 END) as initiated,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  COALESCE(SUM(amount), 0) as total_amount
FROM public.b2c_transactions;
