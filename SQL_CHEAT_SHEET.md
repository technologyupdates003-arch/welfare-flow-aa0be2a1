# Penalty Wallet System - SQL Cheat Sheet

## 🔍 Quick Queries

### View Penalty Wallet Status
```sql
SELECT 
  total_balance,
  total_received,
  total_withdrawn,
  (total_received - total_withdrawn) as expected_balance,
  last_updated
FROM public.penalty_wallet;
```

### View All Unpaid Penalties
```sql
SELECT 
  p.id,
  m.name as member_name,
  m.phone,
  p.amount,
  p.reason,
  p.created_at
FROM public.penalties p
JOIN public.members m ON p.member_id = m.id
WHERE p.is_paid = FALSE
ORDER BY p.created_at DESC;
```

### View Member's Penalties
```sql
SELECT 
  p.id,
  p.amount,
  p.reason,
  p.is_paid,
  p.created_at
FROM public.penalties p
WHERE p.member_id = 'MEMBER_UUID'
ORDER BY p.created_at DESC;
```

### View Payment History
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
ORDER BY pr.created_at DESC
LIMIT 50;
```

### View Verified Payments Only
```sql
SELECT 
  pr.id,
  m.name as member_name,
  pr.amount,
  pr.mpesa_transaction_id,
  pr.verified_at
FROM public.penalty_payment_records pr
JOIN public.members m ON pr.member_id = m.id
WHERE pr.status = 'verified'
ORDER BY pr.verified_at DESC;
```

### View Pending Payments
```sql
SELECT 
  pr.id,
  m.name as member_name,
  pr.amount,
  pr.mpesa_transaction_id,
  pr.created_at
FROM public.penalty_payment_records pr
JOIN public.members m ON pr.member_id = m.id
WHERE pr.status = 'pending'
ORDER BY pr.created_at DESC;
```

### View All Withdrawal Requests
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

### View Pending Withdrawals
```sql
SELECT 
  pw.id,
  pw.amount,
  pw.reason,
  pw.phone_number,
  pw.status,
  pw.created_at
FROM public.penalty_withdrawals pw
WHERE pw.status = 'pending'
ORDER BY pw.created_at DESC;
```

### View Withdrawal with Signatories
```sql
SELECT 
  pw.id,
  pw.amount,
  pw.reason,
  pw.phone_number,
  pw.status,
  ws.signatory_role,
  ws.status as signatory_status,
  ws.approved_at,
  ws.rejected_at
FROM public.penalty_withdrawals pw
LEFT JOIN public.withdrawal_signatories ws ON pw.id = ws.withdrawal_id
ORDER BY pw.created_at DESC, ws.signatory_role;
```

### View Signatory Approvals for Specific Withdrawal
```sql
SELECT 
  signatory_role,
  status,
  approved_at,
  rejected_at,
  rejection_reason
FROM public.withdrawal_signatories
WHERE withdrawal_id = 'WITHDRAWAL_UUID'
ORDER BY signatory_role;
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
  bt.completed_at,
  bt.error_message
FROM public.b2c_transactions bt
JOIN public.penalty_withdrawals pw ON bt.withdrawal_id = pw.id
ORDER BY bt.created_at DESC;
```

### View Completed B2C Transfers
```sql
SELECT 
  bt.id,
  pw.amount,
  bt.phone_number,
  bt.mpesa_transaction_id,
  bt.completed_at
FROM public.b2c_transactions bt
JOIN public.penalty_withdrawals pw ON bt.withdrawal_id = pw.id
WHERE bt.status = 'completed'
ORDER BY bt.completed_at DESC;
```

---

## 📊 Statistics & Reports

### Payment Statistics
```sql
SELECT 
  'Total Payments' as metric,
  COUNT(*) as count,
  SUM(amount) as total
FROM public.penalty_payment_records
UNION ALL
SELECT 
  'Verified Payments',
  COUNT(*),
  SUM(amount)
FROM public.penalty_payment_records
WHERE status = 'verified'
UNION ALL
SELECT 
  'Pending Payments',
  COUNT(*),
  SUM(amount)
FROM public.penalty_payment_records
WHERE status = 'pending'
UNION ALL
SELECT 
  'Failed Payments',
  COUNT(*),
  SUM(amount)
FROM public.penalty_payment_records
WHERE status = 'failed';
```

### Withdrawal Statistics
```sql
SELECT 
  'Total Withdrawals' as metric,
  COUNT(*) as count,
  SUM(amount) as total
FROM public.penalty_withdrawals
UNION ALL
SELECT 
  'Pending Withdrawals',
  COUNT(*),
  SUM(amount)
FROM public.penalty_withdrawals
WHERE status = 'pending'
UNION ALL
SELECT 
  'Approved Withdrawals',
  COUNT(*),
  SUM(amount)
FROM public.penalty_withdrawals
WHERE status = 'approved'
UNION ALL
SELECT 
  'Completed Withdrawals',
  COUNT(*),
  SUM(amount)
FROM public.penalty_withdrawals
WHERE status = 'completed'
UNION ALL
SELECT 
  'Rejected Withdrawals',
  COUNT(*),
  SUM(amount)
FROM public.penalty_withdrawals
WHERE status = 'rejected';
```

### Member Penalty Summary
```sql
SELECT 
  m.id,
  m.name,
  m.phone,
  COUNT(p.id) as total_penalties,
  COUNT(CASE WHEN p.is_paid = FALSE THEN 1 END) as unpaid_penalties,
  COUNT(CASE WHEN p.is_paid = TRUE THEN 1 END) as paid_penalties,
  SUM(CASE WHEN p.is_paid = FALSE THEN p.amount ELSE 0 END) as unpaid_amount,
  SUM(CASE WHEN p.is_paid = TRUE THEN p.amount ELSE 0 END) as paid_amount
FROM public.members m
LEFT JOIN public.penalties p ON m.id = p.member_id
GROUP BY m.id, m.name, m.phone
ORDER BY unpaid_amount DESC;
```

### Signatory Approval Summary
```sql
SELECT 
  signatory_role,
  COUNT(*) as total_assignments,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
FROM public.withdrawal_signatories
GROUP BY signatory_role;
```

### B2C Transfer Summary
```sql
SELECT 
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount,
  MIN(amount) as min_amount,
  MAX(amount) as max_amount
FROM public.b2c_transactions
GROUP BY status;
```

---

## ✏️ Data Modification

### Mark Payment as Verified
```sql
UPDATE public.penalty_payment_records
SET 
  status = 'verified',
  verified_at = now(),
  verified_by = 'ADMIN_USER_UUID'
WHERE id = 'PAYMENT_ID';
```

### Mark Penalty as Paid
```sql
UPDATE public.penalties
SET 
  is_paid = TRUE,
  updated_at = now()
WHERE id = 'PENALTY_ID';
```

### Approve Withdrawal as Signatory
```sql
UPDATE public.withdrawal_signatories
SET 
  status = 'approved',
  approved_at = now()
WHERE withdrawal_id = 'WITHDRAWAL_ID' 
  AND signatory_role = 'chairperson';
```

### Reject Withdrawal with Reason
```sql
UPDATE public.withdrawal_signatories
SET 
  status = 'rejected',
  rejected_at = now(),
  rejection_reason = 'Insufficient documentation'
WHERE withdrawal_id = 'WITHDRAWAL_ID' 
  AND signatory_role = 'secretary';
```

### Update B2C Transaction Status
```sql
UPDATE public.b2c_transactions
SET 
  status = 'completed',
  completed_at = now()
WHERE id = 'B2C_TRANSACTION_ID';
```

### Update Wallet Balance
```sql
UPDATE public.penalty_wallet
SET 
  total_balance = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.penalty_payment_records
    WHERE status = 'verified'
  ),
  last_updated = now()
WHERE id = (SELECT id FROM public.penalty_wallet LIMIT 1);
```

---

## 🔍 Debugging Queries

### Find Orphaned Payment Records
```sql
SELECT pr.id, pr.member_id
FROM public.penalty_payment_records pr
WHERE NOT EXISTS (
  SELECT 1 FROM public.members m WHERE m.id = pr.member_id
);
```

### Find Withdrawals Without Signatories
```sql
SELECT pw.id, pw.amount
FROM public.penalty_withdrawals pw
WHERE NOT EXISTS (
  SELECT 1 FROM public.withdrawal_signatories ws 
  WHERE ws.withdrawal_id = pw.id
);
```

### Find Incomplete Signatory Assignments
```sql
SELECT 
  pw.id,
  COUNT(ws.id) as assigned_signatories,
  COUNT(CASE WHEN ws.status = 'pending' THEN 1 END) as pending_approvals
FROM public.penalty_withdrawals pw
LEFT JOIN public.withdrawal_signatories ws ON pw.id = ws.withdrawal_id
WHERE pw.status IN ('pending', 'approved')
GROUP BY pw.id
HAVING COUNT(ws.id) < 3;
```

### Find Failed B2C Transactions
```sql
SELECT 
  bt.id,
  pw.amount,
  bt.phone_number,
  bt.error_message,
  bt.initiated_at
FROM public.b2c_transactions bt
JOIN public.penalty_withdrawals pw ON bt.withdrawal_id = pw.id
WHERE bt.status = 'failed'
ORDER BY bt.initiated_at DESC;
```

### Check Wallet Balance Discrepancy
```sql
SELECT 
  pw.total_balance as wallet_balance,
  (SELECT COALESCE(SUM(amount), 0) FROM public.penalty_payment_records WHERE status = 'verified') as calculated_balance,
  (SELECT COALESCE(SUM(amount), 0) FROM public.penalty_withdrawals WHERE status = 'completed') as withdrawn_total,
  pw.total_balance - (SELECT COALESCE(SUM(amount), 0) FROM public.penalty_withdrawals WHERE status = 'completed') as expected_balance
FROM public.penalty_wallet pw;
```

---

## 🗑️ Data Cleanup

### Delete Failed Payments
```sql
DELETE FROM public.penalty_payment_records
WHERE status = 'failed'
  AND created_at < now() - INTERVAL '30 days';
```

### Delete Rejected Withdrawals
```sql
DELETE FROM public.penalty_withdrawals
WHERE status = 'rejected'
  AND created_at < now() - INTERVAL '90 days';
```

### Reset Wallet Balance
```sql
UPDATE public.penalty_wallet
SET 
  total_balance = 0,
  total_received = 0,
  total_withdrawn = 0,
  last_updated = now()
WHERE id = (SELECT id FROM public.penalty_wallet LIMIT 1);
```

---

## 📈 Performance Queries

### Check Index Usage
```sql
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE tablename IN (
  'penalty_wallet',
  'penalty_payment_records',
  'penalty_withdrawals',
  'withdrawal_signatories',
  'b2c_transactions'
)
ORDER BY tablename, indexname;
```

### Check Table Sizes
```sql
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'penalty_wallet',
    'penalty_payment_records',
    'penalty_withdrawals',
    'withdrawal_signatories',
    'b2c_transactions'
  )
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Check Slow Queries
```sql
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%penalty%'
  OR query LIKE '%withdrawal%'
  OR query LIKE '%b2c%'
ORDER BY mean_time DESC
LIMIT 10;
```

---

## 🔐 Security Queries

### Check RLS Policies
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN (
  'penalty_payment_records',
  'penalty_withdrawals',
  'withdrawal_signatories',
  'b2c_transactions'
)
ORDER BY tablename, policyname;
```

### Check User Roles
```sql
SELECT 
  u.id,
  u.email,
  ur.role
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
WHERE ur.role IN ('admin', 'chairperson', 'secretary', 'treasurer')
ORDER BY u.email, ur.role;
```

---

**Version**: 1.0.0
**Date**: May 12, 2026
**Status**: Ready for Use
