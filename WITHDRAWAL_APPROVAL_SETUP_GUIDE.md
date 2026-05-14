# Withdrawal Approval System - Setup Guide

## 🚀 Quick Start

### Option 1: If You Have Users Already
```bash
# Run the migration with sample data
supabase migration up 20260512_withdrawal_approval_system.sql
```

### Option 2: If You Don't Have Users Yet
```bash
# Run schema-only migration
supabase migration up 20260512_withdrawal_approval_system_no_users.sql

# Then after creating users, run:
supabase migration up 20260512_withdrawal_approval_system.sql
```

---

## 📋 Prerequisites

### Required Tables (Must Exist First)
- `auth.users` - Supabase authentication users
- `public.members` - Member records
- `public.penalties` - Penalty records
- `public.user_roles` - User role assignments

### Required Migrations (Must Run First)
1. `QUICK_START_MIGRATION_FIXED.sql` - Base schema
2. `20260512_add_b2c_withdrawal.sql` - B2C support

---

## 🔧 Setup Steps

### Step 1: Create Users (If Not Already Done)

In Supabase Auth, create at least 3 users:
- Admin user (for requesting withdrawals)
- Chairperson user (for approvals)
- Secretary user (for approvals)
- Treasurer user (for approvals)

**Get User IDs**:
```sql
SELECT id, email FROM auth.users;
```

### Step 2: Run Base Migrations

```bash
# Step 1: Create base schema
supabase migration up QUICK_START_MIGRATION_FIXED.sql

# Step 2: Add B2C support
supabase migration up 20260512_add_b2c_withdrawal.sql
```

### Step 3: Run Withdrawal Approval Migration

```bash
# Option A: With sample data (if users exist)
supabase migration up 20260512_withdrawal_approval_system.sql

# Option B: Schema only (if users don't exist yet)
supabase migration up 20260512_withdrawal_approval_system_no_users.sql
```

### Step 4: Verify Setup

```sql
-- Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('penalty_withdrawals', 'withdrawal_signatories', 'b2c_transactions');

-- Check sample data (if using Option A)
SELECT COUNT(*) as withdrawal_count FROM public.penalty_withdrawals;
SELECT COUNT(*) as signatory_count FROM public.withdrawal_signatories;
```

---

## 📊 Sample Data

If you ran the migration with sample data, you'll have:

### 6 Sample Withdrawals

| ID | Amount | Status | Approvals | Notes |
|----|--------|--------|-----------|-------|
| 1 | 50,000 | pending | 0/3 | No signatories assigned |
| 2 | 75,000 | submitted | 0/3 | All pending |
| 3 | 100,000 | submitted | 1/3 | Chairperson approved |
| 4 | 60,000 | approved | 3/3 | All approved, ready for B2C |
| 5 | 30,000 | rejected | 1/3 | Secretary rejected |
| 6 | 45,000 | completed | 3/3 | B2C transferred |

### Test Scenarios

**Scenario 1: Pending Approval**
- Withdrawal ID: 2
- Status: submitted
- All 3 signatories pending
- Test: Approve as each signatory

**Scenario 2: Partial Approval**
- Withdrawal ID: 3
- Status: submitted
- Chairperson: approved
- Secretary & Treasurer: pending
- Test: Complete remaining approvals

**Scenario 3: Fully Approved**
- Withdrawal ID: 4
- Status: approved
- All 3 signatories: approved
- Test: Verify B2C transfer initiated

**Scenario 4: Rejected**
- Withdrawal ID: 5
- Status: rejected
- Secretary: rejected
- Test: Request new withdrawal

**Scenario 5: Completed**
- Withdrawal ID: 6
- Status: completed
- B2C transfer: completed
- Test: Verify receipt generated

---

## 🔄 Workflow

### Admin Requests Withdrawal
```sql
INSERT INTO public.penalty_withdrawals (
  amount,
  reason,
  phone_number,
  requested_by,
  status
) VALUES (
  50000,
  'Monthly collection',
  '0712345678',
  'ADMIN_USER_ID',
  'pending'
);
```

### Submit for Approval
```sql
UPDATE public.penalty_withdrawals
SET status = 'submitted', submitted_at = now()
WHERE id = 'WITHDRAWAL_ID';
```

### Assign Signatories
```sql
INSERT INTO public.withdrawal_signatories (
  withdrawal_id,
  signatory_role,
  signatory_user_id,
  status
) VALUES 
  ('WITHDRAWAL_ID', 'chairperson', 'CHAIRPERSON_ID', 'pending'),
  ('WITHDRAWAL_ID', 'secretary', 'SECRETARY_ID', 'pending'),
  ('WITHDRAWAL_ID', 'treasurer', 'TREASURER_ID', 'pending');
```

### Signatory Approves
```sql
UPDATE public.withdrawal_signatories
SET status = 'approved', approved_at = now()
WHERE withdrawal_id = 'WITHDRAWAL_ID'
AND signatory_role = 'chairperson'
AND signatory_user_id = auth.uid();
```

### Check If All Approved
```sql
SELECT 
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approvals
FROM public.withdrawal_signatories
WHERE withdrawal_id = 'WITHDRAWAL_ID';
-- If result = 3, all approved
```

### Initiate B2C Transfer
```sql
-- When all 3 approved, update withdrawal status
UPDATE public.penalty_withdrawals
SET status = 'approved'
WHERE id = 'WITHDRAWAL_ID';

-- Then create B2C transaction
INSERT INTO public.b2c_transactions (
  withdrawal_id,
  mpesa_transaction_id,
  phone_number,
  amount,
  status
) VALUES (
  'WITHDRAWAL_ID',
  'BL123456789',
  '0712345678',
  50000,
  'initiated'
);
```

---

## 🧪 Testing Checklist

### Test 1: Create Withdrawal
- [ ] Admin can create withdrawal
- [ ] Withdrawal status is 'pending'
- [ ] Phone number is validated
- [ ] Amount is stored correctly

### Test 2: Submit for Approval
- [ ] Admin can submit withdrawal
- [ ] Status changes to 'submitted'
- [ ] Signatories are assigned
- [ ] All 3 signatories have 'pending' status

### Test 3: Signatory Approval
- [ ] Chairperson can view pending withdrawals
- [ ] Chairperson can approve
- [ ] Status updates to 'approved'
- [ ] Timestamp recorded

### Test 4: Multiple Approvals
- [ ] Secretary can approve after chairperson
- [ ] Treasurer can approve after secretary
- [ ] System tracks all 3 approvals

### Test 5: Final Approval Triggers B2C
- [ ] When last signatory approves
- [ ] Withdrawal status changes to 'approved'
- [ ] B2C transaction created
- [ ] B2C transfer initiated

### Test 6: Rejection Workflow
- [ ] Signatory can reject with reason
- [ ] Withdrawal status changes to 'rejected'
- [ ] Admin can request new withdrawal
- [ ] Previous withdrawal remains in history

### Test 7: Receipt Generation
- [ ] Receipt created after B2C success
- [ ] Receipt contains all signatures
- [ ] Receipt URL stored in database
- [ ] All signatories receive receipt

---

## 🔍 Verification Queries

### Check Withdrawal Status
```sql
SELECT 
  id,
  amount,
  reason,
  status,
  submitted_at,
  completed_at
FROM public.penalty_withdrawals
ORDER BY created_at DESC;
```

### Check Signatory Approvals
```sql
SELECT 
  ws.withdrawal_id,
  ws.signatory_role,
  ws.status,
  ws.approved_at,
  ws.rejection_reason
FROM public.withdrawal_signatories ws
ORDER BY ws.created_at DESC;
```

### Check Approval Progress
```sql
SELECT 
  pw.id,
  pw.amount,
  pw.status,
  COUNT(CASE WHEN ws.status = 'approved' THEN 1 END) as approvals,
  COUNT(CASE WHEN ws.status = 'rejected' THEN 1 END) as rejections
FROM public.penalty_withdrawals pw
LEFT JOIN public.withdrawal_signatories ws ON pw.id = ws.withdrawal_id
GROUP BY pw.id, pw.amount, pw.status
ORDER BY pw.created_at DESC;
```

### Check B2C Transactions
```sql
SELECT 
  id,
  withdrawal_id,
  mpesa_transaction_id,
  phone_number,
  amount,
  status,
  initiated_at,
  completed_at
FROM public.b2c_transactions
ORDER BY created_at DESC;
```

### Check Pending Approvals by Role
```sql
SELECT 
  ws.signatory_role,
  COUNT(*) as pending_count,
  STRING_AGG(pw.reason, ', ') as withdrawal_reasons
FROM public.withdrawal_signatories ws
JOIN public.penalty_withdrawals pw ON ws.withdrawal_id = pw.id
WHERE ws.status = 'pending'
GROUP BY ws.signatory_role;
```

---

## ⚠️ Troubleshooting

### Error: "null value in column requested_by"
**Cause**: No users exist in auth.users table
**Solution**: 
1. Create users in Supabase Auth first
2. Run migration again

### Error: "relation does not exist"
**Cause**: Base schema not created
**Solution**: Run `QUICK_START_MIGRATION_FIXED.sql` first

### Error: "duplicate key value"
**Cause**: Sample data already exists
**Solution**: This is normal - migrations use `ON CONFLICT DO NOTHING`

### Signatories Not Assigned
**Cause**: Withdrawal status not changed to 'submitted'
**Solution**: Update withdrawal status to 'submitted'

### B2C Transfer Not Initiated
**Cause**: Not all 3 signatories approved
**Solution**: Check that all 3 have status = 'approved'

---

## 📁 Migration Files

```
supabase/migrations/
├── QUICK_START_MIGRATION_FIXED.sql
│   └── Base schema (run first)
├── 20260512_add_b2c_withdrawal.sql
│   └── B2C support (run second)
├── 20260512_withdrawal_approval_system.sql
│   └── Approval system with sample data (run third)
└── 20260512_withdrawal_approval_system_no_users.sql
    └── Approval system schema only (alternative)
```

---

## 🎯 Next Steps

1. **Create Users** (if not done)
   - Create admin, chairperson, secretary, treasurer users
   - Get their user IDs

2. **Run Migrations**
   - Run base schema
   - Run B2C support
   - Run approval system

3. **Test Workflows**
   - Create withdrawal
   - Submit for approval
   - Test each signatory approval
   - Verify B2C transfer
   - Check receipt generation

4. **Deploy**
   - Update routes in App.tsx
   - Update navigation in AdminLayout.tsx
   - Deploy to production

---

## 📞 Support

### Documentation
- `WITHDRAWAL_APPROVAL_GUIDE.md` - Complete guide
- `B2C_WITHDRAWAL_ENHANCEMENT.md` - B2C details
- `PENALTY_WALLET_IMPLEMENTATION_GUIDE.md` - Technical details

### Key Files
- `src/pages/admin/WithdrawalApproval.tsx` - Approval UI
- `src/pages/admin/PenaltyWallet.tsx` - Request form
- `src/lib/b2c.ts` - B2C service

---

**Version**: 1.0.0
**Date**: May 12, 2026
**Status**: Ready for Setup
