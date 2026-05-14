# Withdrawal Approval - Troubleshooting Guide

## Issue: Chairperson Not Seeing Withdrawal Approvals

### Root Causes

There are several reasons why a chairperson might not see withdrawal approvals:

1. **No withdrawals exist** - Migration not run or no sample data created
2. **Signatories not assigned** - Withdrawal status not changed to "submitted"
3. **Chairperson not assigned** - Chairperson user ID not in withdrawal_signatories
4. **Wrong user ID** - Chairperson user ID in database doesn't match logged-in user
5. **RLS policies blocking** - Row-level security preventing access
6. **Wrong withdrawal status** - Withdrawal status not in (pending, submitted, approved)

---

## Diagnostic Steps

### Step 1: Run Diagnostic Queries

Copy and run the entire content of `WITHDRAWAL_APPROVAL_DIAGNOSTIC.sql` in your Supabase SQL editor.

This will show you:
- Total withdrawals and their statuses
- Total signatories and their assignments
- Chairperson user IDs
- Which withdrawals are assigned to chairperson
- RLS policy status
- All users and their roles

### Step 2: Check Each Result

#### Result 1: Total Withdrawals
```
Expected: > 0
If 0: Run migration 20260512_withdrawal_approval_system.sql
```

#### Result 2: Withdrawals by Status
```
Expected: Some with status 'submitted' or 'approved'
If all 'pending': Update withdrawal status to 'submitted'
```

#### Result 3: Total Signatories
```
Expected: > 0 (at least 3 per withdrawal)
If 0: Signatories not assigned - check withdrawal status
```

#### Result 4: Signatories by Role
```
Expected: Some with role 'chairperson'
If 0: No chairperson signatories assigned
```

#### Result 5: Signatories by Status
```
Expected: Some with status 'pending'
If all 'approved' or 'rejected': No pending approvals
```

#### Result 6: Chairperson Users
```
Expected: > 0
If 0: No chairperson role assigned to any user
Solution: Assign chairperson role to a user
```

#### Result 7: Chairperson User IDs
```
Expected: List of user IDs with chairperson role
If empty: No chairperson users exist
Solution: Create a user and assign chairperson role
```

#### Result 8: Chairperson Signatory Assignments
```
Expected: Some rows with signatory_role = 'chairperson'
If empty: Chairperson not assigned to any withdrawals
Solution: Check if withdrawals have signatories assigned
```

#### Result 9: Withdrawals with Signatories
```
Expected: Each withdrawal has 3 signatories (chairperson, secretary, treasurer)
If not: Signatories not assigned - check withdrawal status
```

#### Result 10: RLS Status
```
Expected: rowsecurity = true for penalty_withdrawals and withdrawal_signatories
If false: RLS not enabled - enable it
```

#### Result 11: RLS Policies
```
Expected: Multiple policies for each table
If missing: Policies not created - run migration again
```

#### Result 12: Chairperson Should See
```
Expected: List of withdrawals assigned to chairperson
If empty: Chairperson not assigned to any withdrawals
```

#### Result 13: Chairperson Pending Approvals
```
Expected: List of withdrawals with pending status
If empty: No pending approvals for chairperson
```

#### Result 14: Users and Roles
```
Expected: List of all users with their roles
Verify: Chairperson user ID matches logged-in user
```

#### Result 15: Signatory User IDs
```
Expected: User IDs match auth.users table
If NULL: Signatory user ID not set - check migration
```

---

## Common Issues & Solutions

### Issue 1: "No withdrawals exist"

**Symptoms**:
- Chairperson sees "No pending approvals for you"
- Diagnostic query 1 returns 0

**Solution**:
```sql
-- Run the migration
supabase migration up 20260512_withdrawal_approval_system.sql

-- Or manually create a withdrawal
INSERT INTO public.penalty_withdrawals (
  amount,
  reason,
  phone_number,
  requested_by,
  status
) VALUES (
  50000,
  'Test withdrawal',
  '0712345678',
  (SELECT id FROM auth.users LIMIT 1),
  'submitted'
);

-- Get the withdrawal ID
SELECT id FROM public.penalty_withdrawals ORDER BY created_at DESC LIMIT 1;

-- Assign signatories
INSERT INTO public.withdrawal_signatories (
  withdrawal_id,
  signatory_role,
  signatory_user_id,
  status
) VALUES 
  ('WITHDRAWAL_ID', 'chairperson', 'CHAIRPERSON_USER_ID', 'pending'),
  ('WITHDRAWAL_ID', 'secretary', 'SECRETARY_USER_ID', 'pending'),
  ('WITHDRAWAL_ID', 'treasurer', 'TREASURER_USER_ID', 'pending');
```

---

### Issue 2: "Signatories not assigned"

**Symptoms**:
- Withdrawals exist but have no signatories
- Diagnostic query 3 returns 0

**Solution**:
```sql
-- Check withdrawal status
SELECT id, status FROM public.penalty_withdrawals;

-- Update status to 'submitted' if needed
UPDATE public.penalty_withdrawals
SET status = 'submitted'
WHERE status = 'pending';

-- Manually assign signatories
INSERT INTO public.withdrawal_signatories (
  withdrawal_id,
  signatory_role,
  signatory_user_id,
  status
) VALUES 
  ('WITHDRAWAL_ID', 'chairperson', 'CHAIRPERSON_USER_ID', 'pending'),
  ('WITHDRAWAL_ID', 'secretary', 'SECRETARY_USER_ID', 'pending'),
  ('WITHDRAWAL_ID', 'treasurer', 'TREASURER_USER_ID', 'pending');
```

---

### Issue 3: "Chairperson not assigned"

**Symptoms**:
- Chairperson user exists
- But not assigned to any withdrawals
- Diagnostic query 8 returns empty

**Solution**:
```sql
-- Get chairperson user ID
SELECT id FROM public.user_roles WHERE role = 'chairperson' LIMIT 1;

-- Get withdrawal ID
SELECT id FROM public.penalty_withdrawals WHERE status = 'submitted' LIMIT 1;

-- Assign chairperson to withdrawal
INSERT INTO public.withdrawal_signatories (
  withdrawal_id,
  signatory_role,
  signatory_user_id,
  status
) VALUES (
  'WITHDRAWAL_ID',
  'chairperson',
  'CHAIRPERSON_USER_ID',
  'pending'
);
```

---

### Issue 4: "Wrong user ID"

**Symptoms**:
- Chairperson logged in but sees no approvals
- Diagnostic query 14 shows different user ID than logged-in user

**Solution**:
```sql
-- Get logged-in user ID from browser console
console.log(user.id);

-- Check if this user has chairperson role
SELECT * FROM public.user_roles 
WHERE user_id = 'LOGGED_IN_USER_ID'
AND role = 'chairperson';

-- If not, assign the role
INSERT INTO public.user_roles (user_id, role)
VALUES ('LOGGED_IN_USER_ID', 'chairperson');

-- Check if user is assigned to withdrawals
SELECT * FROM public.withdrawal_signatories
WHERE signatory_user_id = 'LOGGED_IN_USER_ID'
AND signatory_role = 'chairperson';

-- If not, assign to a withdrawal
INSERT INTO public.withdrawal_signatories (
  withdrawal_id,
  signatory_role,
  signatory_user_id,
  status
) VALUES (
  'WITHDRAWAL_ID',
  'chairperson',
  'LOGGED_IN_USER_ID',
  'pending'
);
```

---

### Issue 5: "RLS policies blocking"

**Symptoms**:
- Diagnostic query 10 shows rowsecurity = false
- Or diagnostic query 11 shows no policies

**Solution**:
```sql
-- Enable RLS
ALTER TABLE public.penalty_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_signatories ENABLE ROW LEVEL SECURITY;

-- Create policies (run QUICK_START_MIGRATION_FIXED.sql)
-- Or manually create them:

CREATE POLICY "Signatories can view withdrawals"
ON public.penalty_withdrawals FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.withdrawal_signatories ws
    WHERE ws.withdrawal_id = id AND ws.signatory_user_id = auth.uid()
  )
);

CREATE POLICY "Signatories can view their assignments"
ON public.withdrawal_signatories FOR SELECT
TO authenticated
USING (signatory_user_id = auth.uid());

CREATE POLICY "Signatories can update their status"
ON public.withdrawal_signatories FOR UPDATE
TO authenticated
USING (signatory_user_id = auth.uid());
```

---

### Issue 6: "Wrong withdrawal status"

**Symptoms**:
- Withdrawals exist but status is 'pending'
- Diagnostic query 2 shows all 'pending'

**Solution**:
```sql
-- Update withdrawal status to 'submitted'
UPDATE public.penalty_withdrawals
SET status = 'submitted', submitted_at = now()
WHERE status = 'pending';

-- Verify
SELECT id, status FROM public.penalty_withdrawals;
```

---

## Quick Fix Checklist

- [ ] Run diagnostic queries
- [ ] Check if withdrawals exist (query 1)
- [ ] Check if signatories assigned (query 3)
- [ ] Check if chairperson assigned (query 8)
- [ ] Check if chairperson user exists (query 6)
- [ ] Check if logged-in user ID matches (query 14)
- [ ] Check RLS status (query 10)
- [ ] Check withdrawal status (query 2)
- [ ] Verify chairperson can see withdrawals (query 12)

---

## Manual Setup (If Migration Failed)

### Step 1: Create Withdrawals
```sql
INSERT INTO public.penalty_withdrawals (
  amount,
  reason,
  phone_number,
  requested_by,
  status,
  submitted_at
) VALUES (
  50000,
  'Monthly collection',
  '0712345678',
  (SELECT id FROM auth.users LIMIT 1),
  'submitted',
  now()
);
```

### Step 2: Get User IDs
```sql
SELECT id, email FROM auth.users;
SELECT id FROM public.user_roles WHERE role = 'chairperson';
SELECT id FROM public.user_roles WHERE role = 'secretary';
SELECT id FROM public.user_roles WHERE role = 'treasurer';
```

### Step 3: Assign Signatories
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

### Step 4: Verify
```sql
SELECT * FROM public.penalty_withdrawals;
SELECT * FROM public.withdrawal_signatories;
```

---

## Testing

### Test 1: Chairperson Can See Withdrawal
1. Log in as chairperson
2. Go to "Withdrawal Approvals" page
3. Should see pending withdrawals

### Test 2: Chairperson Can Approve
1. Click "Approve" button
2. Confirm approval
3. Should see success message

### Test 3: All Signatories Approve
1. Chairperson approves
2. Secretary approves
3. Treasurer approves
4. Should trigger B2C transfer

---

## Support

### Files to Check
- `src/pages/admin/WithdrawalApproval.tsx` - Component code
- `QUICK_START_MIGRATION_FIXED.sql` - RLS policies
- `WITHDRAWAL_APPROVAL_DIAGNOSTIC.sql` - Diagnostic queries

### Documentation
- `WITHDRAWAL_APPROVAL_GUIDE.md` - Complete guide
- `WITHDRAWAL_APPROVAL_SETUP_GUIDE.md` - Setup guide

---

**Version**: 1.0.0
**Date**: May 12, 2026
**Status**: Ready for Troubleshooting
