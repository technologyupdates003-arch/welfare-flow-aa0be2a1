-- ============================================================================
-- COMPLETE WELFARE FLOW SETUP SCRIPT
-- Run this in Supabase SQL Editor to set up all required features
-- ============================================================================

-- STEP 1: Fix RLS policies for donation_campaigns (Funds Drives)
-- ============================================================================
DROP POLICY IF EXISTS "Members can view active campaigns" ON public.donation_campaigns;
DROP POLICY IF EXISTS "Anyone authenticated can view active campaigns" ON public.donation_campaigns;
DROP POLICY IF EXISTS "Admin can view all campaigns" ON public.donation_campaigns;

CREATE POLICY "Members can view active campaigns"
ON public.donation_campaigns FOR SELECT
TO authenticated
USING (active = true);

CREATE POLICY "Admin can view all campaigns"
ON public.donation_campaigns FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- STEP 2: Add status column to news table
-- ============================================================================
ALTER TABLE public.news
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived'));

CREATE INDEX IF NOT EXISTS idx_news_status ON public.news(status);

UPDATE public.news SET status = 'active' WHERE status IS NULL;

-- STEP 3: Insert mock penalty data
-- ============================================================================
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

-- STEP 4: Insert mock penalty payments
-- ============================================================================
INSERT INTO public.penalty_payment_records (
  member_id,
  amount,
  payment_ref,
  status,
  created_at
) VALUES
  (
    (SELECT id FROM members LIMIT 1),
    2000,
    'REF-PENALTY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-001',
    'verified',
    NOW() - INTERVAL '5 days'
  ),
  (
    (SELECT id FROM members OFFSET 1 LIMIT 1),
    1500,
    'REF-PENALTY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-002',
    'verified',
    NOW() - INTERVAL '3 days'
  );

-- STEP 5: Insert mock donation campaigns (Funds Drives)
-- ============================================================================
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

-- STEP 6: Insert mock donation payments (Contributions)
-- ============================================================================
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

-- ============================================================================
-- VERIFICATION QUERIES - Check if everything was set up correctly
-- ============================================================================

SELECT '✓ SETUP COMPLETE' as status;

-- Verify penalties
SELECT 
  'Penalties (Unpaid)' as check_name,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM public.penalties
WHERE is_paid = false;

-- Verify penalty payments
SELECT 
  'Penalty Payments (Verified)' as check_name,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM public.penalty_payment_records
WHERE status = 'verified';

-- Verify donation campaigns
SELECT 
  'Donation Campaigns (Active)' as check_name,
  COUNT(*) as count,
  SUM(amount) as total_target
FROM public.donation_campaigns
WHERE active = true;

-- Verify donation payments
SELECT 
  'Donation Payments (Verified)' as check_name,
  COUNT(*) as count,
  SUM(amount) as total_contributed
FROM public.donation_payment_records
WHERE status = 'verified';

-- Show campaign summary
SELECT 
  dc.title,
  dc.amount as target_amount,
  COALESCE(SUM(dpr.amount), 0) as total_contributed,
  COALESCE(COUNT(dpr.id), 0) as contributors,
  ROUND(100.0 * COALESCE(SUM(dpr.amount), 0) / dc.amount, 1) as percentage_complete
FROM public.donation_campaigns dc
LEFT JOIN public.donation_payment_records dpr ON dc.id = dpr.campaign_id AND dpr.status = 'verified'
WHERE dc.active = true
GROUP BY dc.id, dc.title, dc.amount
ORDER BY dc.created_at DESC;
