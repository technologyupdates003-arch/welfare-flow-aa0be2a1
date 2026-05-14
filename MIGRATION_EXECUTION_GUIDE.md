# Migration Execution Guide - Penalty Wallet System

## 🚀 How to Run the Migrations

### Option 1: Quick Start (Recommended)
Run the complete setup in one go:

```sql
-- Copy and paste the entire content of QUICK_START_MIGRATION.sql
-- into your Supabase SQL editor and execute
```

**File**: `QUICK_START_MIGRATION.sql`
**Time**: ~30 seconds
**Result**: Complete penalty wallet system ready to use

---

### Option 2: Step-by-Step (If you prefer individual migrations)

#### Step 1: Create Schema
```bash
supabase migration up 20260512_penalty_wallet_system.sql
```

#### Step 2: Add B2C Support
```bash
supabase migration up 20260512_add_b2c_withdrawal.sql
```

#### Step 3: Seed Sample Data (Optional)
```bash
supabase migration up 20260512_seed_penalty_data.sql
```

---

## 📋 What Gets Created

### Tables (6)
1. **penalty_wallet** - Stores wallet balance
2. **penalty_payment_records** - Member payment records
3. **penalty_withdrawals** - Withdrawal requests
4. **withdrawal_signatories** - Signatory approvals
5. **withdrawal_receipts** - Receipt records
6. **b2c_transactions** - B2C transfer tracking

### Enums (2)
1. **withdrawal_status** - pending, submitted, approved, rejected, completed, cancelled
2. **signatory_status** - pending, approved, rejected

### Triggers (3)
1. **penalty_payment_verified_trigger** - Updates wallet on payment verification
2. **withdrawal_completed_trigger** - Updates wallet on withdrawal completion
3. **b2c_transaction_status_trigger** - Updates B2C transaction timestamps

### Indexes (8)
- Performance optimization for all major queries

### RLS Policies (15+)
- Security policies for all tables

---

## ✅ Verification Steps

### After Running Migration

#### Check 1: Verify Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'penalty_wallet',
  'penalty_payment_records',
  'penalty_withdrawals',
  'withdrawal_signatories',
  'withdrawal_receipts',
  'b2c_transactions'
);
```

Expected: 6 rows

#### Check 2: Verify Wallet Initialized
```sql
SELECT * FROM public.penalty_wallet;
```

Expected: 1 row with total_balance = 0

#### Check 3: Verify Triggers Created
```sql
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name LIKE '%penalty%' OR trigger_name LIKE '%withdrawal%' OR trigger_name LIKE '%b2c%';
```

Expected: 3 triggers

#### Check 4: Verify Indexes Created
```sql
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public'
AND tablename IN (
  'penalty_payment_records',
  'penalty_withdrawals',
  'withdrawal_signatories',
  'b2c_transactions'
);
```

Expected: 8+ indexes

---

## 🔍 Troubleshooting

### Error: "relation does not exist"
**Cause**: Tables haven't been created yet
**Solution**: Run the migration first

```sql
-- Run QUICK_START_MIGRATION.sql
```

### Error: "type does not exist"
**Cause**: Enums haven't been created yet
**Solution**: Run the migration first

### Error: "foreign key constraint failed"
**Cause**: Referenced tables don't exist
**Solution**: Ensure members and penalties tables exist first

### Error: "duplicate key value"
**Cause**: Data already exists
**Solution**: This is normal - migrations use `ON CONFLICT DO NOTHING`

---

## 📊 Sample Data (Optional)

If you want to test with sample data:

```bash
supabase migration up 20260512_seed_penalty_data.sql
```

This creates:
- Sample penalties
- Sample payment records
- Sample withdrawal requests
- Sample signatories
- Sample B2C transactions

---

## 🔄 Data Flow After Setup

### Member Payment Flow
```
1. Member pays penalty via STK Push
2. Payment record created (status: pending)
3. Payment verified
4. Trigger updates wallet balance
5. Penalty marked as paid
```

### Withdrawal Flow
```
1. Admin requests withdrawal
2. Withdrawal record created
3. Three signatories assigned
4. Chairperson approves
5. Secretary approves
6. Treasurer approves (LAST)
7. B2C transfer initiated
8. Funds transferred to phone
9. Withdrawal marked as completed
```

---

## 📁 Migration Files

All files are in `supabase/migrations/`:

```
supabase/migrations/
├── 00_SETUP_INSTRUCTIONS.md                    (Setup guide)
├── 20260512_penalty_wallet_system.sql          (Schema - RUN FIRST)
├── 20260512_add_b2c_withdrawal.sql             (B2C - RUN SECOND)
├── 20260512_seed_penalty_data.sql              (Sample data - Optional)
└── 20260512_production_data_migration.sql      (Real data - Optional)
```

Plus in root:
```
├── QUICK_START_MIGRATION.sql                   (Complete setup in one file)
├── MIGRATION_EXECUTION_GUIDE.md                (This file)
├── DATA_MIGRATION_GUIDE.md                     (Detailed migration guide)
└── SQL_CHEAT_SHEET.md                          (SQL query reference)
```

---

## 🎯 Next Steps After Migration

### 1. Verify Setup
```sql
-- Run verification queries above
```

### 2. Test Payment Flow
```sql
-- Create a test penalty
INSERT INTO public.penalties (member_id, amount, reason, is_paid)
VALUES ('MEMBER_UUID', 1000, 'Test penalty', FALSE);

-- Create a test payment record
INSERT INTO public.penalty_payment_records (member_id, amount, status)
VALUES ('MEMBER_UUID', 1000, 'verified');

-- Check wallet balance updated
SELECT * FROM public.penalty_wallet;
```

### 3. Test Withdrawal Flow
```sql
-- Create a test withdrawal
INSERT INTO public.penalty_withdrawals (amount, reason, phone_number, requested_by, status)
VALUES (5000, 'Test withdrawal', '0712345678', 'ADMIN_UUID', 'pending');

-- Assign signatories
INSERT INTO public.withdrawal_signatories (withdrawal_id, signatory_role, signatory_user_id, status)
VALUES 
  ('WITHDRAWAL_UUID', 'chairperson', 'CHAIRPERSON_UUID', 'pending'),
  ('WITHDRAWAL_UUID', 'secretary', 'SECRETARY_UUID', 'pending'),
  ('WITHDRAWAL_UUID', 'treasurer', 'TREASURER_UUID', 'pending');
```

### 4. Deploy Application
```bash
npm run build
# Deploy to production
```

---

## 📞 Support

### Documentation
- `PENALTY_WALLET_IMPLEMENTATION_GUIDE.md` - Technical details
- `B2C_WITHDRAWAL_ENHANCEMENT.md` - B2C integration
- `DATA_MIGRATION_GUIDE.md` - Data migration details
- `SQL_CHEAT_SHEET.md` - SQL query reference

### Quick Links
- **Setup**: `QUICK_START_MIGRATION.sql`
- **Instructions**: `00_SETUP_INSTRUCTIONS.md`
- **Troubleshooting**: See "Troubleshooting" section above

---

## ✨ You're All Set!

Once the migration completes successfully:

✅ Database schema is ready
✅ B2C support is enabled
✅ All triggers are working
✅ All RLS policies are active
✅ All indexes are optimized
✅ Penalty wallet system is ready to use

---

**Version**: 1.0.0
**Date**: May 12, 2026
**Status**: Ready for Execution
