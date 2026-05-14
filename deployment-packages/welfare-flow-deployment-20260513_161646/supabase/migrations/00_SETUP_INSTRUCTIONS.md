# Penalty Wallet System - Setup Instructions

## ⚠️ IMPORTANT: Run Migrations in Order

The migrations MUST be run in this exact order:

### Step 1: Create Database Schema (REQUIRED FIRST)
**File**: `20260512_penalty_wallet_system.sql`
**Purpose**: Creates all tables, enums, triggers, and RLS policies
**Status**: Must run FIRST

```bash
# Run this first
supabase migration up 20260512_penalty_wallet_system.sql
```

### Step 2: Add B2C Support (REQUIRED SECOND)
**File**: `20260512_add_b2c_withdrawal.sql`
**Purpose**: Adds phone_number column and B2C transaction tracking
**Status**: Must run SECOND

```bash
# Run this second
supabase migration up 20260512_add_b2c_withdrawal.sql
```

### Step 3: Seed Sample Data (OPTIONAL - For Testing)
**File**: `20260512_seed_penalty_data.sql`
**Purpose**: Populates sample data for testing
**Status**: Optional - only for testing/demo

```bash
# Run this third (optional)
supabase migration up 20260512_seed_penalty_data.sql
```

### Step 4: Production Data Migration (OPTIONAL - For Real Data)
**File**: `20260512_production_data_migration.sql`
**Purpose**: Migrates real data from existing tables
**Status**: Optional - only for production

```bash
# Run this for production data migration
supabase migration up 20260512_production_data_migration.sql
```

---

## 🔧 Quick Setup

### For Development/Testing
```bash
# 1. Create schema
supabase migration up 20260512_penalty_wallet_system.sql

# 2. Add B2C support
supabase migration up 20260512_add_b2c_withdrawal.sql

# 3. Seed sample data
supabase migration up 20260512_seed_penalty_data.sql
```

### For Production
```bash
# 1. Create schema
supabase migration up 20260512_penalty_wallet_system.sql

# 2. Add B2C support
supabase migration up 20260512_add_b2c_withdrawal.sql

# 3. Migrate real data
supabase migration up 20260512_production_data_migration.sql
```

---

## ✅ Verification

After each migration, verify it was successful:

### After Step 1 (Schema Creation)
```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'penalty_wallet',
  'penalty_payment_records',
  'penalty_withdrawals',
  'withdrawal_signatories',
  'withdrawal_receipts'
);
```

Expected output: 5 tables

### After Step 2 (B2C Support)
```sql
-- Check if B2C table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'b2c_transactions';

-- Check if phone_number column exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'penalty_withdrawals' 
AND column_name = 'phone_number';
```

Expected output: b2c_transactions table and phone_number column

### After Step 3 (Seed Data)
```sql
-- Check if data was seeded
SELECT COUNT(*) as wallet_count FROM public.penalty_wallet;
SELECT COUNT(*) as penalty_count FROM public.penalties;
SELECT COUNT(*) as payment_count FROM public.penalty_payment_records;
SELECT COUNT(*) as withdrawal_count FROM public.penalty_withdrawals;
```

Expected output: Data counts > 0

---

## 🚨 If You Get an Error

### Error: "relation does not exist"
**Cause**: Schema migration hasn't been run yet
**Solution**: Run Step 1 first

```bash
supabase migration up 20260512_penalty_wallet_system.sql
```

### Error: "column does not exist"
**Cause**: B2C migration hasn't been run yet
**Solution**: Run Step 2

```bash
supabase migration up 20260512_add_b2c_withdrawal.sql
```

### Error: "foreign key constraint failed"
**Cause**: Referenced tables don't have data
**Solution**: 
1. Ensure members table has data
2. Ensure user_roles table has data
3. Run seed data migration

### Error: "duplicate key value"
**Cause**: Data already exists
**Solution**: This is normal - migrations use `ON CONFLICT DO NOTHING`

---

## 📊 What Gets Created

### Tables
- `penalty_wallet` - Stores wallet balance
- `penalty_payment_records` - Records of member payments
- `penalty_withdrawals` - Withdrawal requests
- `withdrawal_signatories` - Signatory approvals
- `withdrawal_receipts` - Receipt records
- `b2c_transactions` - B2C transfer tracking

### Enums
- `withdrawal_status` - pending, submitted, approved, rejected, completed, cancelled
- `signatory_status` - pending, approved, rejected

### Triggers
- `penalty_payment_verified_trigger` - Updates wallet on payment verification
- `withdrawal_completed_trigger` - Updates wallet on withdrawal completion
- `b2c_transaction_status_trigger` - Updates B2C transaction timestamps

### RLS Policies
- 12+ policies for security and access control

### Indexes
- 8+ indexes for performance optimization

---

## 🔄 Migration Order Diagram

```
Step 1: Schema Creation
├── Create Tables
├── Create Enums
├── Create Triggers
├── Create RLS Policies
└── Create Indexes
    ↓
Step 2: B2C Support
├── Add phone_number column
├── Create b2c_transactions table
├── Create B2C RLS policies
└── Create B2C indexes
    ↓
Step 3: Seed Data (Optional)
├── Initialize wallet
├── Create sample penalties
├── Create payment records
├── Create withdrawals
├── Create signatories
└── Create B2C transactions
    ↓
Step 4: Production Migration (Optional)
├── Migrate existing penalties
├── Migrate existing payments
├── Migrate existing withdrawals
├── Assign signatories
└── Migrate B2C transactions
```

---

## 📝 Migration Files Location

All migration files are in: `supabase/migrations/`

```
supabase/migrations/
├── 20260512_penalty_wallet_system.sql          (Schema - RUN FIRST)
├── 20260512_add_b2c_withdrawal.sql             (B2C - RUN SECOND)
├── 20260512_seed_penalty_data.sql              (Sample Data - Optional)
├── 20260512_production_data_migration.sql      (Real Data - Optional)
└── 00_SETUP_INSTRUCTIONS.md                    (This file)
```

---

## ✨ After Setup

Once all migrations are complete:

1. ✅ Database schema is ready
2. ✅ B2C support is enabled
3. ✅ Sample data is loaded (if you ran Step 3)
4. ✅ Real data is migrated (if you ran Step 4)
5. ✅ All RLS policies are active
6. ✅ All triggers are working
7. ✅ All indexes are optimized

You can now:
- Use the penalty wallet system
- Create penalties
- Process payments
- Request withdrawals
- Approve withdrawals
- Process B2C transfers

---

## 🆘 Need Help?

### Check Migration Status
```bash
# List all migrations
supabase migration list

# Check migration history
supabase migration status
```

### Rollback a Migration
```bash
# Rollback last migration
supabase migration down

# Rollback specific migration
supabase migration down 20260512_seed_penalty_data.sql
```

### View Migration Logs
```bash
# Check Supabase logs
supabase logs
```

---

**Version**: 1.0.0
**Date**: May 12, 2026
**Status**: Ready for Setup
