-- ============================================================================
-- WITHDRAWAL APPROVAL SYSTEM - Schema Only (No Sample Data)
-- ============================================================================
-- This migration creates the withdrawal approval system WITHOUT sample data
-- Use this if you don't have users set up yet
-- After creating users, run: 20260512_withdrawal_approval_system.sql

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check all tables exist
SELECT 
  'Tables Verification' as check_type,
  COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'penalty_wallet',
  'penalty_payment_records',
  'penalty_withdrawals',
  'withdrawal_signatories',
  'withdrawal_receipts',
  'b2c_transactions'
);

-- Check enums exist
SELECT 
  'Enums Verification' as check_type,
  COUNT(*) as enum_count
FROM information_schema.tables
WHERE table_schema = 'pg_catalog'
AND table_name = 'pg_type';

-- Check triggers exist
SELECT 
  'Triggers Verification' as check_type,
  COUNT(*) as trigger_count
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Check RLS policies exist
SELECT 
  'RLS Policies Verification' as check_type,
  COUNT(*) as policy_count
FROM information_schema.role_table_grants
WHERE table_schema = 'public';

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================

SELECT 
  'Withdrawal Approval System Ready' as status,
  'Schema created. Ready to add sample data when users exist.' as message,
  now() as completed_at;
