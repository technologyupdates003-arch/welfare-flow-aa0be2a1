# Data Migration Guide - Penalty Wallet System

## 📋 Overview

This guide provides SQL scripts and instructions for migrating data into the penalty wallet system. It covers:
- Initializing the penalty wallet
- Seeding sample penalties
- Creating payment records
- Setting up withdrawal requests
- Configuring signatories
- Tracking B2C transactions

---

## 🗂️ Migration Files

### 1. **20260512_penalty_wallet_system.sql**
**Purpose**: Create database schema
**Contents**:
- Tables: penalty_wallet, penalty_payment_records, penalty_withdrawals, withdrawal_signatories, withdrawal_receipts
- Enums: withdrawal_status, signatory_status
- Triggers: penalty_payment_verified_trigger, withdrawal_completed_trigger
- RLS Policies: All security policies
- Indexes: Performance optimization

**Run First**: Yes (creates schema)

### 2. **20260512_add_b2c_withdrawal.sql**
**Purpose**: Add B2C transfer support
**Contents**:
- Add phone_number column to penalty_withdrawals
- Create b2c_transactions table
- Add RLS policies for B2C
- Create indexes for B2C lookups

**Run Second**: Yes (adds B2C support)

### 3. **20260512_seed_penalty_data.sql**
**Purpose**: Populate sample data for testing
**Contents**:
- Initialize penalty wallet
- Create sample penalties
- Create payment records
- Create withdrawal requests
- Create signatory records
- Create B2C transactions
- Verify data integrity

**Run Third**: Yes (for testing/demo)

---

## 🚀 Migration Steps

### Step 1: Create Schema
```bash
# Run the main schema migration
supabase migration up 20260512_penalty_wallet_system.sql
```

**Verifies**:
- All tables created
- All enums created
- All triggers created
- All RLS policies applied
- All indexes created

### Step 2: Add B2C Support
```bash
# Run the B2C migration
supabase migration up 20260512_add_b2c_withdrawal.sql
```

**Verifies**:
- phone_number column added
- b2c_transactions table created
- B2C RLS policies applied
- B2C indexes created

### Step 3: Seed Sample Data (Optional)
```bash
# Run the seed migration for testing
supabase migration up 20260512_seed_penalty_data.sql
```

**Verifies**:
- Penalty wallet initialized
- Sample penalties created
- Payment records created
- Withdrawal requests created
- Signatories assigned
- B2C transactions logged

---

## 📊 Data Structure

### Penalty Wallet
```sql
-- Single record storing wallet totals
penalty_wallet {
  id: UUID,
  total_balance: NUMERIC,        -- Current balance
  total_received: NUMERIC,       -- All payments received
  total_withdrawn: NUMERIC,      -- All withdrawals made
  last_updated: TIMESTAMPTZ,
  created_at: TIMESTAMPTZ
}
```

### Penalties
```sql
-- Individual penalties assigned to members
penalties {
  id: UUID,
  member_id: UUID,
  amount: NUMERIC,
  reason: TEXT,
  is_paid: BOOLEAN,
  created_at: TIMESTAMPTZ,
  updated_at: TIMESTAMPTZ
}
```

### Penalty Payment Records
```sql
-- Records of member payments
penalty_payment_records {
  id: UUID,
  member_id: UUID,
  penalty_id: UUID,
  amount: NUMERIC,
  payment_ref: TEXT,
  mpesa_transaction_id: TEXT,
  status: TEXT ('pending', 'verified', 'failed'),
  verified_by: UUID,
  verified_at: TIMESTAMPTZ,
  created_at: TIMESTAMPTZ,
  updated_at: TIMESTAMPTZ
}
```

### Penalty Withdrawals
```sql
-- Withdrawal requests from admin
penalty_withdrawals {
  id: UUID,
  amount: NUMERIC,
  reason: TEXT,
  phone_number: TEXT,            -- M-Pesa phone for transfer
  requested_by: UUID,
  status: withdrawal_status,
  submitted_at: TIMESTAMPTZ,
  completed_at: TIMESTAMPTZ,
  receipt_url: TEXT,
  created_at: TIMESTAMPTZ,
  updated_at: TIMESTAMPTZ
}
```

### Withdrawal Signatories
```sql
-- Signatory approvals for withdrawals
withdrawal_signatories {
  id: UUID,
  withdrawal_id: UUID,
  signatory_role: TEXT ('chairperson', 'secretary', 'treasurer'),
  signatory_user_id: UUID,
  status: signatory_status ('pending', 'approved', 'rejected'),
  signature_url: TEXT,
  rejection_reason: TEXT,
  approved_at: TIMESTAMPTZ,
  rejected_at: TIMESTAMPTZ,
  created_at: TIMESTAMPTZ,
  updated_at: TIMESTAMPTZ
}
```

### B2C Transactions
```sql
-- M-Pesa B2C transfer records
b2c_transactions {
  id: UUID,
  withdrawal_id: UUID,
  mpesa_transaction_id: TEXT,
  phone_number: TEXT,
  amount: NUMERIC,
  status: TEXT ('initiated', 'pending', 'completed', 'failed'),
  initiated_at: TIMESTAMPTZ,
  completed_at: TIMESTAMPTZ,
  error_message: TEXT,
  created_at: TIMESTAMPTZ,
  updated_at: TIMESTAMPTZ
}
```

---

## 🔄 Data Flow

### Member Payment Flow
```
1. Member has unpaid penalties
   ↓
2. Member pays via STK Push
   ↓
3. Payment record created (status: pending)
   ↓
4. Payment verified by system
   ↓
5. Payment record updated (status: verified)
   ↓
6. Trigger updates penalty_wallet balance
   ↓
7. Penalty marked as paid
```

### Withdrawal Flow
```
1. Admin requests withdrawal
   ↓
2. Withdrawal record created (status: pending)
   ↓
3. Three signatory records created (status: pending)
   ↓
4. Chairperson approves
   ↓
5. Secretary approves
   ↓
6. Treasurer approves (LAST)
   ↓
7. B2C transfer initiated
   ↓
8. B2C transaction record created
   ↓
9. Transfer successful
   ↓
10. Withdrawal status = completed
    B2C status = completed
    Trigger updates wallet balance
```

---

## 📝 Sample Data Queries

### View Penalty Wallet
```sql
SELECT * FROM public.penalty_wallet;
```

### View All Penalties
```sql
SELECT 
  p.id,
  m.name as member_name,
  p.amount,
  p.reason,
  p.is_paid,
  p.created_at
FROM public.penalties p
JOIN public.members m ON p.member_id = m.id
ORDER BY p.created_at DESC;
```

### View Payment Records
```sql
SELECT 
  pr.id,
  m.name as member_name,
  pr.amount,
  pr.status,
  pr.mpesa_transaction_id,
  pr.verified_at,
  pr.created_at
FROM public.penalty_payment_records pr
JOIN public.members m ON pr.member_id = m.id
ORDER BY pr.created_at DESC;
```

### View Withdrawal Requests
```sql
SELECT 
  pw.id,
  pw.amount,
  pw.reason,
  pw.phone_number,
  pw.status,
  pw.created_at
FROM public.penalty_withdrawals pw
ORDER BY pw.created_at DESC;
```

### View Signatory Approvals
```sql
SELECT 
  ws.id,
  pw.amount,
  pw.reason,
  ws.signatory_role,
  ws.status,
  ws.approved_at,
  ws.rejected_at
FROM public.withdrawal_signatories ws
JOIN public.penalty_withdrawals pw ON ws.withdrawal_id = pw.id
ORDER BY ws.created_at DESC;
```

### View B2C Transactions
```sql
SELECT 
  bt.id,
  pw.amount,
  bt.phone_number,
  bt.status,
  bt.mpesa_transaction_id,
  bt.initiated_at,
  bt.completed_at
FROM public.b2c_transactions bt
JOIN public.penalty_withdrawals pw ON bt.withdrawal_id = pw.id
ORDER BY bt.created_at DESC;
```

---

## 🔍 Data Validation Queries

### Check Wallet Balance
```sql
SELECT 
  'Wallet Balance' as metric,
  total_balance,
  total_received,
  total_withdrawn,
  (total_received - total_withdrawn) as expected_balance
FROM public.penalty_wallet;
```

### Verify Payment Totals
```sql
SELECT 
  'Payment Totals' as metric,
  COUNT(*) as total_payments,
  COUNT(CASE WHEN status = 'verified' THEN 1 END) as verified_count,
  SUM(CASE WHEN status = 'verified' THEN amount ELSE 0 END) as verified_total,
  SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_total
FROM public.penalty_payment_records;
```

### Check Withdrawal Status
```sql
SELECT 
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM public.penalty_withdrawals
GROUP BY status;
```

### Verify Signatory Approvals
```sql
SELECT 
  withdrawal_id,
  COUNT(*) as total_signatories,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
FROM public.withdrawal_signatories
GROUP BY withdrawal_id;
```

### Check B2C Transfer Status
```sql
SELECT 
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM public.b2c_transactions
GROUP BY status;
```

---

## 🔧 Custom Data Migration

### Import Existing Penalties
```sql
-- If you have penalties in another table
INSERT INTO public.penalties (member_id, amount, reason, is_paid, created_at, updated_at)
SELECT 
  m.id,
  p.penalty_amount,
  p.penalty_reason,
  p.paid_status,
  p.created_date,
  p.updated_date
FROM old_penalties_table p
JOIN public.members m ON p.member_id = m.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.penalties 
  WHERE member_id = m.id AND amount = p.penalty_amount
);
```

### Import Existing Payments
```sql
-- If you have payment records in another table
INSERT INTO public.penalty_payment_records (
  member_id,
  penalty_id,
  amount,
  payment_ref,
  mpesa_transaction_id,
  status,
  verified_at,
  created_at,
  updated_at
)
SELECT 
  m.id,
  p.id,
  op.payment_amount,
  op.payment_reference,
  op.mpesa_ref,
  CASE WHEN op.verified = TRUE THEN 'verified' ELSE 'pending' END,
  CASE WHEN op.verified = TRUE THEN op.verified_date ELSE NULL END,
  op.created_date,
  op.updated_date
FROM old_payments_table op
JOIN public.members m ON op.member_id = m.id
JOIN public.penalties p ON m.id = p.member_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.penalty_payment_records 
  WHERE mpesa_transaction_id = op.mpesa_ref
);
```

### Update Wallet Balance After Import
```sql
-- Recalculate wallet balance after importing data
UPDATE public.penalty_wallet
SET
  total_balance = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.penalty_payment_records
    WHERE status = 'verified'
  ),
  total_received = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.penalty_payment_records
    WHERE status = 'verified'
  ),
  total_withdrawn = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.penalty_withdrawals
    WHERE status = 'completed'
  ),
  last_updated = now()
WHERE id = (SELECT id FROM public.penalty_wallet LIMIT 1);
```

---

## ⚠️ Important Notes

### Before Migration
- [ ] Backup existing database
- [ ] Test migrations in staging first
- [ ] Verify all required tables exist
- [ ] Check user roles are set up correctly
- [ ] Ensure M-Pesa credentials configured

### During Migration
- [ ] Run migrations in order
- [ ] Check for errors after each migration
- [ ] Verify data integrity
- [ ] Monitor database performance

### After Migration
- [ ] Verify all data imported correctly
- [ ] Check wallet balance calculations
- [ ] Test payment workflow
- [ ] Test withdrawal workflow
- [ ] Test signatory approvals
- [ ] Test B2C transfers

---

## 🐛 Troubleshooting

### Issue: Foreign Key Constraint Error
**Solution**: Ensure referenced tables exist and have data
```sql
-- Check if members table has data
SELECT COUNT(*) FROM public.members;

-- Check if user_roles table has data
SELECT COUNT(*) FROM public.user_roles;
```

### Issue: Duplicate Key Error
**Solution**: Use ON CONFLICT DO NOTHING or check for existing data
```sql
-- Check for duplicates
SELECT COUNT(*) FROM public.penalties 
GROUP BY member_id, amount 
HAVING COUNT(*) > 1;
```

### Issue: Wallet Balance Incorrect
**Solution**: Recalculate balance
```sql
-- Recalculate wallet balance
UPDATE public.penalty_wallet
SET total_balance = (
  SELECT COALESCE(SUM(amount), 0)
  FROM public.penalty_payment_records
  WHERE status = 'verified'
),
last_updated = now();
```

### Issue: Signatories Not Assigned
**Solution**: Verify signatory users exist
```sql
-- Check for signatory users
SELECT u.id, ur.role
FROM auth.users u
JOIN public.user_roles ur ON u.id = ur.user_id
WHERE ur.role IN ('chairperson', 'secretary', 'treasurer');
```

---

## 📞 Support

### Documentation
- `PENALTY_WALLET_IMPLEMENTATION_GUIDE.md` - Technical details
- `B2C_WITHDRAWAL_ENHANCEMENT.md` - B2C integration
- `PENALTY_WALLET_ACCESS_GUIDE.md` - User guide

### Scripts
- `20260512_penalty_wallet_system.sql` - Schema creation
- `20260512_add_b2c_withdrawal.sql` - B2C support
- `20260512_seed_penalty_data.sql` - Sample data

---

**Version**: 1.0.0
**Date**: May 12, 2026
**Status**: Ready for Production
