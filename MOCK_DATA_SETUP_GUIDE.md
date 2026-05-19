# Mock Data Setup Guide - Penalty Wallet & Funds Drive Testing

## Overview
This guide helps you set up mock data to test the withdrawal flow for both penalty wallet and funds drive features.

## Files Created

### 1. INSERT_MOCK_PENALTY_WALLET.sql
Inserts test data for penalty wallet testing.

### 2. INSERT_MOCK_FUNDS_DRIVE.sql
Inserts test data for funds drive (donation campaigns) testing.

---

## Setup Instructions

### Step 1: Access Supabase SQL Editor
1. Go to your Supabase project
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"

### Step 2: Insert Penalty Wallet Mock Data
1. Copy the contents of `INSERT_MOCK_PENALTY_WALLET.sql`
2. Paste into the SQL Editor
3. Click "Run"
4. Verify the output shows inserted records

**What gets created:**
- 5 test penalties (unpaid)
- 2 test penalty payments (pending)
- Total penalty amount: ~20,500 KES

### Step 3: Insert Funds Drive Mock Data
1. Copy the contents of `INSERT_MOCK_FUNDS_DRIVE.sql`
2. Paste into the SQL Editor
3. Click "Run"
4. Verify the output shows inserted records

**What gets created:**
- 5 active donation campaigns (Funds Drives)
- 6 test donations/contributions
- Total contributed: ~240,000 KES across campaigns

---

## Mock Data Details

### Penalty Wallet Data

| Member | Amount | Reason | Status |
|--------|--------|--------|--------|
| Member 1 | 5,000 KES | Late contribution | Unpaid |
| Member 1 | 3,000 KES | Missed meeting | Unpaid |
| Member 1 | 2,500 KES | Rule violation | Unpaid |
| Member 2 | 4,000 KES | Late contribution | Unpaid |
| Member 3 | 6,000 KES | Missed meeting | Unpaid |

**Total Penalties:** 20,500 KES

### Funds Drive Data

| Campaign | Target | Contributed | Contributors |
|----------|--------|-------------|---------------|
| School Building Fund | 500,000 KES | 80,000 KES | 2 |
| Medical Emergency Fund | 300,000 KES | 25,000 KES | 1 |
| Water Project | 750,000 KES | 75,000 KES | 1 |
| Youth Skills Training | 250,000 KES | 20,000 KES | 1 |
| Health Clinic | 400,000 KES | 40,000 KES | 1 |

**Total Contributed:** 240,000 KES

---

## Testing the Withdrawal Flow

### For Penalty Wallet Withdrawal:
1. Log in as Treasurer
2. Go to Treasurer Dashboard → Penalty Wallet
3. You should see pending penalties
4. Click "Withdraw" or "Request Withdrawal"
5. Test the withdrawal approval flow
6. Verify B2C transfer simulation

### For Funds Drive Withdrawal:
1. Log in as Treasurer
2. Go to Treasurer Dashboard → Donation Wallet
3. You should see funds from donations
4. Click "Withdraw" or "Request Withdrawal"
5. Test the withdrawal approval flow
6. Verify B2C transfer simulation

---

## Verification Queries

### Check Penalty Data
```sql
SELECT 
  m.name as member_name,
  p.amount,
  p.reason,
  p.is_paid,
  p.created_at
FROM penalties p
JOIN members m ON p.member_id = m.id
WHERE p.is_paid = false
ORDER BY p.created_at DESC;
```

### Check Funds Drive Data
```sql
SELECT 
  dc.title,
  dc.amount as target,
  COUNT(dpr.id) as contributors,
  SUM(dpr.amount) as total_contributed,
  ROUND(100.0 * SUM(dpr.amount) / dc.amount, 1) as percentage
FROM donation_campaigns dc
LEFT JOIN donation_payment_records dpr ON dc.id = dpr.campaign_id
WHERE dc.active = true
GROUP BY dc.id, dc.title, dc.amount;
```

### Check Wallet Balances
```sql
-- Penalty Wallet Balance
SELECT 
  m.name,
  SUM(p.amount) as penalty_balance
FROM penalties p
JOIN members m ON p.member_id = m.id
WHERE p.is_paid = false
GROUP BY m.id, m.name;

-- Donation Wallet Balance
SELECT 
  m.name,
  SUM(dpr.amount) as donation_balance
FROM donation_payment_records dpr
JOIN members m ON dpr.member_id = m.id
WHERE dpr.status = 'verified'
GROUP BY m.id, m.name;
```

---

## Cleanup (Optional)

If you want to remove the mock data later:

```sql
-- Delete mock penalties
DELETE FROM penalties 
WHERE created_at > NOW() - INTERVAL '35 days';

-- Delete mock donations
DELETE FROM donation_payment_records 
WHERE created_at > NOW() - INTERVAL '35 days';

-- Delete mock campaigns
DELETE FROM donation_campaigns 
WHERE created_at > NOW() - INTERVAL '35 days';
```

---

## Notes

- Mock data uses actual member IDs from your database
- Timestamps are relative to current time for realistic testing
- Phone numbers are test numbers (0712345678, etc.)
- M-Pesa transaction IDs are mock values (LHR919WXYZ, etc.)
- All amounts are in KES (Kenyan Shillings)
- Data is marked as "verified" for donations to simulate completed payments

---

## Troubleshooting

### Error: "No members found"
- Ensure you have at least 3 members in your database
- Run: `SELECT COUNT(*) FROM members;`

### Error: "No auth users found"
- Ensure you have at least 1 user in auth.users
- The script uses the first user as the campaign creator

### Data not appearing in UI
- Refresh the page
- Check browser console for errors
- Verify RLS policies allow viewing the data
- Check that the user has the correct role

---

## Next Steps

1. ✅ Run the SQL scripts to insert mock data
2. ✅ Verify data appears in the dashboards
3. ✅ Test the withdrawal flow end-to-end
4. ✅ Test approval/rejection of withdrawals
5. ✅ Verify B2C transfer simulation
6. ✅ Test with different user roles (Treasurer, Admin, etc.)
