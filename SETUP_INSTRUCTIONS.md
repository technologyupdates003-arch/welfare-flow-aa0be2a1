# Welfare Flow - Complete Setup Instructions

## Overview
This guide walks you through setting up all required features and mock data for testing the withdrawal flow.

---

## Quick Setup (Recommended)

### Option 1: Run Everything at Once (FASTEST)

1. **Open Supabase SQL Editor**
   - Go to your Supabase project
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

2. **Copy and Run COMPLETE_SETUP.sql**
   - Open the file: `COMPLETE_SETUP.sql`
   - Copy ALL the content
   - Paste into Supabase SQL Editor
   - Click "Run"
   - Wait for completion (should see ✓ SETUP COMPLETE)

3. **Refresh Your Application**
   - Go back to your browser
   - Refresh the page (F5 or Cmd+R)
   - Navigate to:
     - **Penalty Wallet**: `/admin/penalty-wallet` or `/treasurer/penalty-wallet`
     - **Funds Wallet**: `/admin/donations` or `/treasurer/donation-wallet`

4. **Verify Data Appears**
   - Penalty Wallet should show: **KES 20,500** (5 unpaid penalties)
   - Funds Wallet should show: **KES 240,000** (6 verified donations)

---

## Step-by-Step Setup (If You Prefer Individual Steps)

### Step 1: Fix Funds Drive Access (RLS Policies)
```sql
-- File: FIX_DONATION_CAMPAIGNS_RLS.sql
-- This allows members to see active funds drives
```
- Copy content from `FIX_DONATION_CAMPAIGNS_RLS.sql`
- Paste into Supabase SQL Editor
- Click "Run"

### Step 2: Add News Status Field
```sql
-- File: ADD_STATUS_TO_NEWS.sql
-- This adds status column to hide archived news from members
```
- Copy content from `ADD_STATUS_TO_NEWS.sql`
- Paste into Supabase SQL Editor
- Click "Run"

### Step 3: Insert Penalty Wallet Mock Data
```sql
-- File: INSERT_MOCK_PENALTY_WALLET.sql
-- This creates 5 test penalties and 2 penalty payments
```
- Copy content from `INSERT_MOCK_PENALTY_WALLET.sql`
- Paste into Supabase SQL Editor
- Click "Run"
- Verify output shows penalties and payments

### Step 4: Insert Funds Drive Mock Data
```sql
-- File: INSERT_MOCK_FUNDS_DRIVE.sql
-- This creates 5 test campaigns and 6 test donations
```
- Copy content from `INSERT_MOCK_FUNDS_DRIVE.sql`
- Paste into Supabase SQL Editor
- Click "Run"
- Verify output shows campaigns and donations

---

## What Gets Created

### Penalty Wallet Data
- **5 Unpaid Penalties**: Total KES 20,500
  - Member 1: KES 5,000 (Late contribution)
  - Member 1: KES 3,000 (Missed meeting)
  - Member 1: KES 2,500 (Rule violation)
  - Member 2: KES 4,000 (Late contribution)
  - Member 3: KES 6,000 (Missed meeting)

- **2 Verified Penalty Payments**: Total KES 3,500
  - Member 1: KES 2,000
  - Member 2: KES 1,500

### Funds Drive Data
- **5 Active Campaigns**: Total Target KES 2,200,000
  - School Building Fund: KES 500,000 target
  - Medical Emergency Fund: KES 300,000 target
  - Water Project: KES 750,000 target
  - Youth Skills Training: KES 250,000 target
  - Health Clinic: KES 400,000 target

- **6 Verified Donations**: Total KES 240,000
  - School Building: KES 80,000 (2 contributors)
  - Medical Fund: KES 25,000 (1 contributor)
  - Water Project: KES 75,000 (1 contributor)
  - Youth Training: KES 20,000 (1 contributor)
  - Health Clinic: KES 40,000 (1 contributor)

---

## Testing the Withdrawal Flow

### Test Penalty Wallet Withdrawal
1. Log in as **Treasurer** or **Admin**
2. Go to **Penalty Wallet** page
3. You should see: **Total Balance: KES 20,500**
4. Click "Request Withdrawal"
5. Enter amount (e.g., 5,000)
6. Enter phone number (e.g., 0712345678)
7. Click "Submit"
8. Go to **Withdrawal Approvals** to approve/reject

### Test Funds Drive Withdrawal
1. Log in as **Treasurer** or **Admin**
2. Go to **Funds Wallet** page
3. You should see: **Total Balance: KES 240,000**
4. Click "Request Withdrawal"
5. Enter amount (e.g., 50,000)
6. Enter phone number (e.g., 0712345678)
7. Click "Submit"
8. Go to **Withdrawal Approvals** to approve/reject

### Test Member Contribution
1. Log in as **Member**
2. Go to **Funds Drives** page
3. You should see all 5 active campaigns
4. Click "Contribute" on any campaign
5. Enter amount and complete payment flow

---

## Troubleshooting

### Wallets Still Show Zero
**Solution**: Refresh the page (F5). The wallets now calculate dynamically from transaction data.

### Can't See Funds Drives as Member
**Solution**: Run `FIX_DONATION_CAMPAIGNS_RLS.sql` to fix RLS policies.

### Campaigns Not Showing in Member View
**Solution**: Ensure campaigns have `active = true` in the database.

### SQL Errors
**Solution**: 
- Check that you have at least 3 members in your database
- Check that you have at least 1 user in auth.users
- Run `VERIFY_WALLET_DATA.sql` to check table contents

---

## Files Reference

| File | Purpose | Run Order |
|------|---------|-----------|
| `COMPLETE_SETUP.sql` | All-in-one setup (RECOMMENDED) | 1st |
| `FIX_DONATION_CAMPAIGNS_RLS.sql` | Fix member access to funds drives | 1st |
| `ADD_STATUS_TO_NEWS.sql` | Add news archiving feature | 2nd |
| `INSERT_MOCK_PENALTY_WALLET.sql` | Create penalty test data | 3rd |
| `INSERT_MOCK_FUNDS_DRIVE.sql` | Create funds drive test data | 4th |
| `VERIFY_WALLET_DATA.sql` | Check if data was created | Anytime |

---

## Next Steps After Setup

1. ✅ Test penalty wallet withdrawal flow
2. ✅ Test funds drive withdrawal flow
3. ✅ Test member contribution to funds drives
4. ✅ Test withdrawal approvals (Treasurer → Secretary → Chairperson)
5. ✅ Verify B2C transfer simulation
6. ✅ Test with different user roles

---

## Need Help?

If something doesn't work:
1. Run `VERIFY_WALLET_DATA.sql` to check data
2. Check browser console for errors (F12)
3. Verify you're logged in with correct role
4. Refresh the page
5. Check Supabase logs for RLS policy errors
