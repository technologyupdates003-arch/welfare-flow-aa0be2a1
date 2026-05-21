-- Verify wallet data exists and check all related tables

-- Check penalty_wallet table
SELECT 'penalty_wallet' as table_name, COUNT(*) as row_count FROM public.penalty_wallet;

-- Check donation_wallet table
SELECT 'donation_wallet' as table_name, COUNT(*) as row_count FROM public.donation_wallet;

-- Check penalties table
SELECT 'penalties' as table_name, COUNT(*) as row_count FROM public.penalties;

-- Check penalty_payment_records table
SELECT 'penalty_payment_records' as table_name, COUNT(*) as row_count FROM public.penalty_payment_records;

-- Check donation_campaigns table
SELECT 'donation_campaigns' as table_name, COUNT(*) as row_count FROM public.donation_campaigns;

-- Check donation_payment_records table
SELECT 'donation_payment_records' as table_name, COUNT(*) as row_count FROM public.donation_payment_records;

-- Show penalty_wallet content
SELECT * FROM public.penalty_wallet;

-- Show donation_wallet content
SELECT * FROM public.donation_wallet;

-- Show penalties (unpaid)
SELECT id, member_id, amount, reason, is_paid FROM public.penalties WHERE is_paid = false LIMIT 5;

-- Show penalty_payment_records
SELECT id, member_id, amount, status FROM public.penalty_payment_records LIMIT 5;

-- Show donation_campaigns
SELECT id, title, amount, active FROM public.donation_campaigns LIMIT 5;

-- Show donation_payment_records
SELECT id, member_id, campaign_id, amount, status FROM public.donation_payment_records LIMIT 5;
