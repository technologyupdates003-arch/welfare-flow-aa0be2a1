# Quick Reference - SQL Scripts

## 🚀 FASTEST WAY TO SET UP

### Copy This Entire Script and Run in Supabase SQL Editor:

```sql
-- COMPLETE SETUP - Copy and paste everything below into Supabase SQL Editor

-- 1. Fix RLS for Funds Drives
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

-- 2. Add News Status
ALTER TABLE public.news
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived'));

CREATE INDEX IF NOT EXISTS idx_news_status ON public.news(status);

UPDATE public.news SET status = 'active' WHERE status IS NULL;

-- 3. Insert Penalties
INSERT INTO public.penalties (member_id, amount, reason, is_paid, created_at) VALUES
  ((SELECT id FROM members LIMIT 1), 5000, 'Late contribution payment', false, NOW() - INTERVAL '30 days'),
  ((SELECT id FROM members LIMIT 1), 3000, 'Missed meeting attendance', false, NOW() - INTERVAL '15 days'),
  ((SELECT id FROM members LIMIT 1), 2500, 'Violation of group rules', false, NOW() - INTERVAL '7 days'),
  ((SELECT id FROM members OFFSET 1 LIMIT 1), 4000, 'Late contribution payment', false, NOW() - INTERVAL '20 days'),
  ((SELECT id FROM members OFFSET 2 LIMIT 1), 6000, 'Missed meeting attendance', false, NOW() - INTERVAL '10 days');

-- 4. Insert Penalty Payments
INSERT INTO public.penalty_payment_records (member_id, amount, payment_ref, status, created_at) VALUES
  ((SELECT id FROM members LIMIT 1), 2000, 'REF-PENALTY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-001', 'verified', NOW() - INTERVAL '5 days'),
  ((SELECT id FROM members OFFSET 1 LIMIT 1), 1500, 'REF-PENALTY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-002', 'verified', NOW() - INTERVAL '3 days');

-- 5. Insert Campaigns
INSERT INTO public.donation_campaigns (title, description, amount, active, created_by, created_at) VALUES
  ('School Building Fund 2026', 'Contributions towards building a new community school facility. Target: KES 500,000', 500000, true, (SELECT id FROM auth.users LIMIT 1), NOW() - INTERVAL '30 days'),
  ('Medical Emergency Fund', 'Emergency fund for members facing medical crises. Target: KES 300,000', 300000, true, (SELECT id FROM auth.users LIMIT 1), NOW() - INTERVAL '20 days'),
  ('Water Project Initiative', 'Drilling and installation of water wells in the community. Target: KES 750,000', 750000, true, (SELECT id FROM auth.users LIMIT 1), NOW() - INTERVAL '15 days'),
  ('Youth Skills Training', 'Vocational training program for youth members. Target: KES 250,000', 250000, true, (SELECT id FROM auth.users LIMIT 1), NOW() - INTERVAL '10 days'),
  ('Community Health Clinic', 'Setting up a health clinic for preventive care. Target: KES 400,000', 400000, true, (SELECT id FROM auth.users LIMIT 1), NOW() - INTERVAL '5 days');

-- 6. Insert Donations
INSERT INTO public.donation_payment_records (member_id, campaign_id, amount, phone_number, mpesa_transaction_id, status, created_at) VALUES
  ((SELECT id FROM members LIMIT 1), (SELECT id FROM donation_campaigns WHERE title = 'School Building Fund 2026' LIMIT 1), 50000, '0712345678', 'LHR919WXYZ', 'verified', NOW() - INTERVAL '25 days'),
  ((SELECT id FROM members OFFSET 1 LIMIT 1), (SELECT id FROM donation_campaigns WHERE title = 'School Building Fund 2026' LIMIT 1), 30000, '0722456789', 'LHR920WXYZ', 'verified', NOW() - INTERVAL '20 days'),
  ((SELECT id FROM members OFFSET 2 LIMIT 1), (SELECT id FROM donation_campaigns WHERE title = 'Medical Emergency Fund' LIMIT 1), 25000, '0733567890', 'LHR921WXYZ', 'verified', NOW() - INTERVAL '18 days'),
  ((SELECT id FROM members LIMIT 1), (SELECT id FROM donation_campaigns WHERE title = 'Water Project Initiative' LIMIT 1), 75000, '0712345678', 'LHR922WXYZ', 'verified', NOW() - INTERVAL '12 days'),
  ((SELECT id FROM members OFFSET 1 LIMIT 1), (SELECT id FROM donation_campaigns WHERE title = 'Youth Skills Training' LIMIT 1), 20000, '0722456789', 'LHR923WXYZ', 'verified', NOW() - INTERVAL '8 days'),
  ((SELECT id FROM members OFFSET 2 LIMIT 1), (SELECT id FROM donation_campaigns WHERE title = 'Community Health Clinic' LIMIT 1), 40000, '0733567890', 'LHR924WXYZ', 'verified', NOW() - INTERVAL '3 days');

-- DONE! Refresh your browser
SELECT '✓ SETUP COMPLETE - Refresh your browser now' as status;
```

---

## 📊 What You'll Get

| Feature | Amount | Count |
|---------|--------|-------|
| Unpaid Penalties | KES 20,500 | 5 |
| Verified Penalty Payments | KES 3,500 | 2 |
| Active Funds Drives | KES 2,200,000 target | 5 |
| Verified Donations | KES 240,000 | 6 |

---

## 🔍 Verify It Worked

Run this to check:

```sql
SELECT 'Penalties' as type, COUNT(*) as count, SUM(amount) as total FROM public.penalties WHERE is_paid = false
UNION ALL
SELECT 'Penalty Payments', COUNT(*), SUM(amount) FROM public.penalty_payment_records WHERE status = 'verified'
UNION ALL
SELECT 'Campaigns', COUNT(*), SUM(amount) FROM public.donation_campaigns WHERE active = true
UNION ALL
SELECT 'Donations', COUNT(*), SUM(amount) FROM public.donation_payment_records WHERE status = 'verified';
```

---

## 🧪 Test It

1. **Penalty Wallet**: Go to `/admin/penalty-wallet` → Should show **KES 20,500**
2. **Funds Wallet**: Go to `/admin/donations` → Should show **KES 240,000**
3. **Funds Drives**: Go to `/member/donate` → Should see **5 campaigns**

---

## 📁 All Available Scripts

- `COMPLETE_SETUP.sql` - Everything in one file ⭐ USE THIS
- `FIX_DONATION_CAMPAIGNS_RLS.sql` - Just RLS policies
- `ADD_STATUS_TO_NEWS.sql` - Just news status
- `INSERT_MOCK_PENALTY_WALLET.sql` - Just penalties
- `INSERT_MOCK_FUNDS_DRIVE.sql` - Just donations
- `VERIFY_WALLET_DATA.sql` - Check what's in database
