-- Insert mock data for funds drive (donation campaigns) testing
-- This creates test campaigns and donations for withdrawal flow testing

-- Get an admin user ID for created_by field
-- Adjust if you have a specific admin user

-- Insert test donation campaigns (Funds Drives)
INSERT INTO public.donation_campaigns (
  title,
  description,
  amount,
  active,
  created_by,
  created_at
) VALUES
  (
    'School Building Fund 2026',
    'Contributions towards building a new community school facility. Target: KES 500,000',
    500000,
    true,
    (SELECT id FROM auth.users LIMIT 1),
    NOW() - INTERVAL '30 days'
  ),
  (
    'Medical Emergency Fund',
    'Emergency fund for members facing medical crises. Target: KES 300,000',
    300000,
    true,
    (SELECT id FROM auth.users LIMIT 1),
    NOW() - INTERVAL '20 days'
  ),
  (
    'Water Project Initiative',
    'Drilling and installation of water wells in the community. Target: KES 750,000',
    750000,
    true,
    (SELECT id FROM auth.users LIMIT 1),
    NOW() - INTERVAL '15 days'
  ),
  (
    'Youth Skills Training',
    'Vocational training program for youth members. Target: KES 250,000',
    250000,
    true,
    (SELECT id FROM auth.users LIMIT 1),
    NOW() - INTERVAL '10 days'
  ),
  (
    'Community Health Clinic',
    'Setting up a health clinic for preventive care. Target: KES 400,000',
    400000,
    true,
    (SELECT id FROM auth.users LIMIT 1),
    NOW() - INTERVAL '5 days'
  );

-- Insert test donation payments (contributions to funds drives)
INSERT INTO public.donation_payment_records (
  member_id,
  campaign_id,
  amount,
  mpesa_transaction_id,
  status,
  created_at
) VALUES
  (
    (SELECT id FROM members LIMIT 1),
    (SELECT id FROM donation_campaigns WHERE title = 'School Building Fund 2026' LIMIT 1),
    50000,
    'LHR919WXYZ',
    'verified',
    NOW() - INTERVAL '25 days'
  ),
  (
    (SELECT id FROM members OFFSET 1 LIMIT 1),
    (SELECT id FROM donation_campaigns WHERE title = 'School Building Fund 2026' LIMIT 1),
    30000,
    'LHR920WXYZ',
    'verified',
    NOW() - INTERVAL '20 days'
  ),
  (
    (SELECT id FROM members OFFSET 2 LIMIT 1),
    (SELECT id FROM donation_campaigns WHERE title = 'Medical Emergency Fund' LIMIT 1),
    25000,
    'LHR921WXYZ',
    'verified',
    NOW() - INTERVAL '18 days'
  ),
  (
    (SELECT id FROM members LIMIT 1),
    (SELECT id FROM donation_campaigns WHERE title = 'Water Project Initiative' LIMIT 1),
    75000,
    'LHR922WXYZ',
    'verified',
    NOW() - INTERVAL '12 days'
  ),
  (
    (SELECT id FROM members OFFSET 1 LIMIT 1),
    (SELECT id FROM donation_campaigns WHERE title = 'Youth Skills Training' LIMIT 1),
    20000,
    'LHR923WXYZ',
    'verified',
    NOW() - INTERVAL '8 days'
  ),
  (
    (SELECT id FROM members OFFSET 2 LIMIT 1),
    (SELECT id FROM donation_campaigns WHERE title = 'Community Health Clinic' LIMIT 1),
    40000,
    'LHR924WXYZ',
    'verified',
    NOW() - INTERVAL '3 days'
  );

-- Update or insert donation wallet balance
-- Calculate total donations (verified)
DELETE FROM public.donation_wallet;

INSERT INTO public.donation_wallet (
  total_balance,
  total_received,
  total_withdrawn
) VALUES (
  (SELECT COALESCE(SUM(amount), 0) FROM public.donation_payment_records WHERE status = 'verified'),
  (SELECT COALESCE(SUM(amount), 0) FROM public.donation_payment_records WHERE status = 'verified'),
  (SELECT COALESCE(SUM(amount), 0) FROM public.donation_withdrawals WHERE status = 'completed')
);

-- Verify the data was inserted
SELECT 
  'Donation Campaigns' as table_name,
  COUNT(*) as record_count,
  SUM(amount) as total_target_amount
FROM public.donation_campaigns
WHERE active = true

UNION ALL

SELECT 
  'Donation Payments' as table_name,
  COUNT(*) as record_count,
  SUM(amount) as total_contributed
FROM public.donation_payment_records
WHERE status = 'verified'

UNION ALL

SELECT 
  'Donation Wallet' as table_name,
  1 as record_count,
  total_balance as total_contributed
FROM public.donation_wallet;

-- Show summary by campaign
SELECT 
  dc.title,
  dc.amount as target_amount,
  COALESCE(SUM(dpr.amount), 0) as total_contributed,
  COALESCE(COUNT(dpr.id), 0) as number_of_contributors,
  ROUND(100.0 * COALESCE(SUM(dpr.amount), 0) / dc.amount, 1) as percentage_complete
FROM public.donation_campaigns dc
LEFT JOIN public.donation_payment_records dpr ON dc.id = dpr.campaign_id AND dpr.status = 'verified'
WHERE dc.active = true
GROUP BY dc.id, dc.title, dc.amount
ORDER BY dc.created_at DESC;
