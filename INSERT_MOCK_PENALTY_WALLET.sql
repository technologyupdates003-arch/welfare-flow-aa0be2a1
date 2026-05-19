-- Insert mock data for penalty wallet testing
-- This creates test penalties and penalty payments for withdrawal flow testing

-- First, get a test member ID (adjust if needed)
-- You can replace 'test-member-id' with an actual member ID from your database

-- Insert test penalties
INSERT INTO public.penalties (
  member_id,
  amount,
  reason,
  is_paid,
  created_at
) VALUES
  (
    (SELECT id FROM members LIMIT 1),
    5000,
    'Late contribution payment',
    false,
    NOW() - INTERVAL '30 days'
  ),
  (
    (SELECT id FROM members LIMIT 1),
    3000,
    'Missed meeting attendance',
    false,
    NOW() - INTERVAL '15 days'
  ),
  (
    (SELECT id FROM members LIMIT 1),
    2500,
    'Violation of group rules',
    false,
    NOW() - INTERVAL '7 days'
  ),
  (
    (SELECT id FROM members OFFSET 1 LIMIT 1),
    4000,
    'Late contribution payment',
    false,
    NOW() - INTERVAL '20 days'
  ),
  (
    (SELECT id FROM members OFFSET 2 LIMIT 1),
    6000,
    'Missed meeting attendance',
    false,
    NOW() - INTERVAL '10 days'
  );

-- Insert test penalty payments (for tracking payment history)
INSERT INTO public.penalty_payments (
  member_id,
  amount,
  reference_number,
  payment_date,
  status,
  created_at
) VALUES
  (
    (SELECT id FROM members LIMIT 1),
    2000,
    'REF-PENALTY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-001',
    NOW() - INTERVAL '5 days',
    'pending',
    NOW() - INTERVAL '5 days'
  ),
  (
    (SELECT id FROM members OFFSET 1 LIMIT 1),
    1500,
    'REF-PENALTY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-002',
    NOW() - INTERVAL '3 days',
    'pending',
    NOW() - INTERVAL '3 days'
  );

-- Update or insert penalty wallet balance
-- Calculate total penalties (unpaid)
DELETE FROM public.penalty_wallet;

INSERT INTO public.penalty_wallet (
  total_balance,
  total_received,
  total_withdrawn
) VALUES (
  (SELECT COALESCE(SUM(amount), 0) FROM public.penalties WHERE is_paid = false),
  (SELECT COALESCE(SUM(amount), 0) FROM public.penalty_payments WHERE status = 'verified'),
  (SELECT COALESCE(SUM(amount), 0) FROM public.penalty_withdrawals WHERE status = 'completed')
);

-- Verify the data was inserted
SELECT 
  'Penalties' as table_name,
  COUNT(*) as record_count,
  SUM(amount) as total_amount
FROM public.penalties
WHERE is_paid = false

UNION ALL

SELECT 
  'Penalty Payments' as table_name,
  COUNT(*) as record_count,
  SUM(amount) as total_amount
FROM public.penalty_payments
WHERE status = 'pending'

UNION ALL

SELECT 
  'Penalty Wallet' as table_name,
  1 as record_count,
  total_balance as total_amount
FROM public.penalty_wallet;
