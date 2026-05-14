# Withdrawal Approval System - Complete Guide

## 📋 Overview

The withdrawal approval system manages the multi-signatory approval workflow for penalty wallet withdrawals. It requires approval from three signatories (Chairperson, Secretary, Treasurer) before funds are transferred via B2C.

---

## 🔄 Approval Workflow

### Step 1: Admin Requests Withdrawal
- Admin submits withdrawal request with:
  - Amount to withdraw
  - Reason for withdrawal
  - Phone number for B2C transfer
- Status: `pending` → `submitted`

### Step 2: Signatories Assigned
- System automatically assigns three signatories:
  - **Chairperson** (signatory_role: 'chairperson')
  - **Secretary** (signatory_role: 'secretary')
  - **Treasurer** (signatory_role: 'treasurer')
- Each gets a pending approval task

### Step 3: Individual Approvals
- Each signatory reviews the withdrawal request
- Can **approve** or **reject** with reason
- Status updates: `pending` → `approved` or `rejected`

### Step 4: Final Approval Check
- When **last signatory approves** (all 3 approved):
  - Withdrawal status: `submitted` → `approved`
  - B2C transfer automatically initiated
  - Funds transferred to phone number
  - Withdrawal status: `approved` → `completed`

### Step 5: Rejection Handling
- If **any signatory rejects**:
  - Withdrawal status: `submitted` → `rejected`
  - Admin can request new withdrawal
  - Previous withdrawal remains in history

---

## 📊 Database Schema

### penalty_withdrawals Table
```sql
CREATE TABLE penalty_withdrawals (
  id UUID PRIMARY KEY,
  amount NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  phone_number TEXT,
  requested_by UUID NOT NULL,
  status withdrawal_status (pending, submitted, approved, rejected, completed, cancelled),
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  receipt_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Status Flow**:
```
pending → submitted → approved → completed
                   ↓
                rejected
```

### withdrawal_signatories Table
```sql
CREATE TABLE withdrawal_signatories (
  id UUID PRIMARY KEY,
  withdrawal_id UUID NOT NULL,
  signatory_role TEXT (chairperson, secretary, treasurer),
  signatory_user_id UUID,
  status signatory_status (pending, approved, rejected),
  signature_url TEXT,
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(withdrawal_id, signatory_role)
);
```

### b2c_transactions Table
```sql
CREATE TABLE b2c_transactions (
  id UUID PRIMARY KEY,
  withdrawal_id UUID NOT NULL,
  mpesa_transaction_id TEXT UNIQUE,
  phone_number TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT (initiated, pending, completed, failed),
  initiated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

## 🛠️ Implementation Details

### Database Triggers

#### 1. Automatic Signatory Assignment
When withdrawal status changes to `submitted`, automatically assign three signatories:

```sql
CREATE OR REPLACE FUNCTION assign_withdrawal_signatories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $
BEGIN
  IF NEW.status = 'submitted' AND OLD.status != 'submitted' THEN
    -- Get chairperson, secretary, treasurer user IDs
    -- Insert into withdrawal_signatories
  END IF;
  RETURN NEW;
END;
$;
```

#### 2. Check All Approvals
When a signatory approves, check if all three have approved:

```sql
CREATE OR REPLACE FUNCTION check_all_approvals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $
BEGIN
  IF NEW.status = 'approved' THEN
    -- Check if all 3 signatories approved
    -- If yes, update withdrawal status to 'approved'
    -- Trigger B2C transfer
  END IF;
  RETURN NEW;
END;
$;
```

#### 3. Automatic B2C Transfer
When withdrawal status changes to `approved`, initiate B2C transfer:

```sql
CREATE OR REPLACE FUNCTION initiate_b2c_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Call B2C API
    -- Create b2c_transaction record
    -- Update withdrawal status to 'completed' on success
  END IF;
  RETURN NEW;
END;
$;
```

### RLS Policies

#### Signatories Can View Their Withdrawals
```sql
CREATE POLICY "Signatories can view their withdrawals"
ON penalty_withdrawals FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM withdrawal_signatories ws
    WHERE ws.withdrawal_id = id 
    AND ws.signatory_user_id = auth.uid()
  )
);
```

#### Signatories Can Update Their Approval Status
```sql
CREATE POLICY "Signatories can update their status"
ON withdrawal_signatories FOR UPDATE
TO authenticated
USING (signatory_user_id = auth.uid());
```

---

## 🧪 Testing Scenarios

### Scenario 1: Pending Withdrawal
- Status: `pending`
- No signatories assigned yet
- Admin can edit or cancel

### Scenario 2: Submitted Withdrawal
- Status: `submitted`
- All 3 signatories assigned with `pending` status
- Awaiting first approval

### Scenario 3: Partially Approved
- Status: `submitted`
- 1-2 signatories approved
- Awaiting remaining approvals

### Scenario 4: Fully Approved
- Status: `approved`
- All 3 signatories approved
- B2C transfer initiated
- Status changes to `completed` on success

### Scenario 5: Rejected
- Status: `rejected`
- Any signatory rejected
- Admin can request new withdrawal

### Scenario 6: Completed
- Status: `completed`
- B2C transfer successful
- Receipt generated
- All signatories receive receipt

---

## 📱 UI Components

### Admin Withdrawal Request Form
**Location**: `src/pages/admin/PenaltyWallet.tsx`

**Fields**:
- Amount (required)
- Reason (required)
- Phone Number (required, validated)
- Submit button

**Actions**:
- Submit withdrawal request
- View pending withdrawals
- View approval status

### Signatory Approval Page
**Location**: `src/pages/admin/WithdrawalApproval.tsx`

**Features**:
- List pending withdrawals for signatory
- View withdrawal details
- Approve button
- Reject button with reason input
- View approval history

**Workflow**:
1. Signatory sees pending withdrawals
2. Reviews withdrawal details
3. Clicks approve or reject
4. If approve and last signatory → B2C transfer initiated
5. If reject → withdrawal marked as rejected

---

## 🔐 Security & Access Control

### Role-Based Access

| Role | Can Request | Can Approve | Can View |
|------|-------------|------------|---------|
| Admin | ✅ | ❌ | ✅ |
| Chairperson | ❌ | ✅ | ✅ (own) |
| Secretary | ❌ | ✅ | ✅ (own) |
| Treasurer | ❌ | ✅ | ✅ (own) |
| Member | ❌ | ❌ | ❌ |

### RLS Policies
- Admins can view all withdrawals
- Signatories can only view their assigned withdrawals
- Signatories can only update their own approval status
- Members cannot access withdrawal system

---

## 📊 Sample Data

The migration creates 6 sample withdrawals:

1. **Pending** (No approvals)
   - Amount: 50,000
   - Status: pending
   - No signatories assigned

2. **Submitted** (All pending)
   - Amount: 75,000
   - Status: submitted
   - All 3 signatories pending

3. **Partially Approved** (1 approved)
   - Amount: 100,000
   - Status: submitted
   - Chairperson: approved
   - Secretary & Treasurer: pending

4. **Fully Approved** (All approved)
   - Amount: 60,000
   - Status: approved
   - All 3 signatories: approved

5. **Rejected** (Secretary rejected)
   - Amount: 30,000
   - Status: rejected
   - Secretary: rejected

6. **Completed** (B2C transferred)
   - Amount: 45,000
   - Status: completed
   - All 3 signatories: approved
   - B2C transaction: completed

---

## 🚀 Running the Migration

### Option 1: Quick Start
```bash
# Copy entire content of QUICK_START_MIGRATION_FIXED.sql
# Then run this migration
supabase migration up 20260512_withdrawal_approval_system.sql
```

### Option 2: Step by Step
```bash
# Step 1: Run base schema
supabase migration up 20260512_penalty_wallet_system.sql

# Step 2: Add B2C support
supabase migration up 20260512_add_b2c_withdrawal.sql

# Step 3: Add approval system data
supabase migration up 20260512_withdrawal_approval_system.sql
```

---

## ✅ Verification Queries

### Check All Withdrawals
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

### Check Signatory Assignments
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

### Check Approval Status by Withdrawal
```sql
SELECT 
  pw.id,
  pw.amount,
  pw.reason,
  pw.status,
  COUNT(CASE WHEN ws.status = 'approved' THEN 1 END) as approvals,
  COUNT(CASE WHEN ws.status = 'rejected' THEN 1 END) as rejections,
  STRING_AGG(ws.signatory_role || ':' || ws.status, ', ') as details
FROM public.penalty_withdrawals pw
LEFT JOIN public.withdrawal_signatories ws ON pw.id = ws.withdrawal_id
GROUP BY pw.id, pw.amount, pw.reason, pw.status
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
WHERE ws.status = 'pending' AND pw.status IN ('submitted', 'approved')
GROUP BY ws.signatory_role;
```

---

## 🔧 Troubleshooting

### Issue: Signatories Not Assigned
**Cause**: Withdrawal status not changed to `submitted`
**Solution**: Ensure withdrawal status is updated to `submitted` before expecting signatories

### Issue: B2C Transfer Not Initiated
**Cause**: Not all 3 signatories approved
**Solution**: Check that all 3 signatories have status = `approved`

### Issue: Withdrawal Stuck in "Submitted"
**Cause**: One or more signatories haven't approved
**Solution**: Check `withdrawal_signatories` table for pending approvals

### Issue: Phone Number Invalid
**Cause**: Phone number format incorrect
**Solution**: Use format `0712345678` or `+254712345678`

---

## 📞 Support

### Documentation Files
- `PENALTY_WALLET_IMPLEMENTATION_GUIDE.md` - Technical details
- `B2C_WITHDRAWAL_ENHANCEMENT.md` - B2C integration
- `DATA_MIGRATION_GUIDE.md` - Data migration
- `SQL_CHEAT_SHEET.md` - SQL queries

### Key Files
- `supabase/migrations/20260512_withdrawal_approval_system.sql` - This migration
- `src/pages/admin/WithdrawalApproval.tsx` - Approval UI
- `src/pages/admin/PenaltyWallet.tsx` - Request form
- `src/lib/b2c.ts` - B2C service

---

## 📝 Notes

- All timestamps are in UTC (TIMESTAMPTZ)
- Phone numbers stored in E.164 format (0712345678)
- B2C transfers are asynchronous - check status via polling
- Receipts are generated after successful B2C transfer
- All signatories receive receipt via email/SMS

---

**Version**: 1.0.0
**Date**: May 12, 2026
**Status**: Ready for Production
