-- Populate Penalty Wallet with mock data
UPDATE penalty_wallet 
SET 
  total_received = 500000,
  total_withdrawn = 150000,
  total_balance = 350000
WHERE id = (SELECT id FROM penalty_wallet LIMIT 1);

-- Populate Donation/Fund Drive Wallet with mock data
UPDATE donation_wallet 
SET 
  total_received = 750000,
  total_withdrawn = 200000,
  total_balance = 550000
WHERE id = (SELECT id FROM donation_wallet LIMIT 1);

-- Populate Operational Wallet with mock data
UPDATE operational_wallet 
SET 
  total_received = 300000,
  total_withdrawn = 80000,
  total_balance = 220000
WHERE id = (SELECT id FROM operational_wallet LIMIT 1);

-- Insert mock penalty withdrawals
INSERT INTO penalty_withdrawals (amount, reason, phone_number, status, requested_by, submitted_at, created_at)
SELECT 
  (ARRAY[10000, 15000, 20000, 25000, 30000])[floor(random() * 5 + 1)],
  'Member payout - ' || (ARRAY['Wedding', 'Death', 'Retirement', 'Emergency'])[floor(random() * 4 + 1)],
  '254' || LPAD((floor(random() * 900000000 + 100000000))::text, 9, '0'),
  'completed',
  (SELECT id FROM auth.users LIMIT 1),
  NOW() - (INTERVAL '1 day' * floor(random() * 30)),
  NOW() - (INTERVAL '1 day' * floor(random() * 30))
FROM generate_series(1, 8);

-- Insert mock donation withdrawals
INSERT INTO donation_withdrawals (amount, reason, phone_number, status, requested_by, submitted_at, created_at)
SELECT 
  (ARRAY[15000, 20000, 25000, 30000, 35000])[floor(random() * 5 + 1)],
  'Fund drive payout - ' || (ARRAY['Community Project', 'Member Support', 'Emergency Fund'])[floor(random() * 3 + 1)],
  '254' || LPAD((floor(random() * 900000000 + 100000000))::text, 9, '0'),
  'completed',
  (SELECT id FROM auth.users LIMIT 1),
  NOW() - (INTERVAL '1 day' * floor(random() * 30)),
  NOW() - (INTERVAL '1 day' * floor(random() * 30))
FROM generate_series(1, 6);

-- Insert mock operational withdrawals
INSERT INTO operational_withdrawals (amount, reason, phone_number, status, requested_by, submitted_at, created_at)
SELECT 
  (ARRAY[5000, 8000, 10000, 12000, 15000])[floor(random() * 5 + 1)],
  'Operational expense - ' || (ARRAY['Office Supplies', 'Transport', 'Utilities', 'Maintenance'])[floor(random() * 4 + 1)],
  '254' || LPAD((floor(random() * 900000000 + 100000000))::text, 9, '0'),
  'completed',
  (SELECT id FROM auth.users LIMIT 1),
  NOW() - (INTERVAL '1 day' * floor(random() * 30)),
  NOW() - (INTERVAL '1 day' * floor(random() * 30))
FROM generate_series(1, 5);

-- Insert mock expenses
INSERT INTO expenses (expense_type, category, amount, description, recipient_name, payment_method, status, created_by, created_at)
SELECT 
  (ARRAY['operational', 'payout', 'emergency'])[floor(random() * 3 + 1)],
  (ARRAY['Office Supplies', 'Transport', 'Utilities', 'Maintenance', 'Repairs'])[floor(random() * 5 + 1)],
  (ARRAY[2000, 3000, 5000, 7000, 10000])[floor(random() * 5 + 1)],
  'Expense for ' || (ARRAY['Office', 'Transport', 'Utilities', 'Maintenance'])[floor(random() * 4 + 1)],
  (ARRAY['John Supplier', 'Jane Vendor', 'ABC Company', 'XYZ Services'])[floor(random() * 4 + 1)],
  (ARRAY['cash', 'bank_transfer', 'cheque'])[floor(random() * 3 + 1)],
  'pending',
  (SELECT id FROM auth.users LIMIT 1),
  NOW() - (INTERVAL '1 day' * floor(random() * 30))
FROM generate_series(1, 12);

-- Insert mock contributions (if not already present)
INSERT INTO contributions (member_id, amount, month, year, status, created_at)
SELECT 
  m.id,
  (ARRAY[1000, 2000, 3000, 5000, 10000])[floor(random() * 5 + 1)],
  EXTRACT(MONTH FROM NOW())::int,
  EXTRACT(YEAR FROM NOW())::int,
  'verified',
  NOW() - (INTERVAL '1 day' * floor(random() * 30))
FROM members m
WHERE m.is_active = true
LIMIT 20
ON CONFLICT DO NOTHING;

-- Create wallet transactions for reporting
INSERT INTO wallet_transactions (wallet_type, direction, source, reference_id, reference_table, party_name, party_phone, gross_amount, mpesa_charge, system_fee, net_amount, running_balance, mpesa_receipt, status, occurred_at)
SELECT 
  (ARRAY['penalty', 'donation', 'operational'])[floor(random() * 3 + 1)],
  (ARRAY['in', 'out'])[floor(random() * 2 + 1)],
  (ARRAY['c2b', 'b2c', 'topup', 'expense', 'transfer'])[floor(random() * 5 + 1)],
  gen_random_uuid(),
  (ARRAY['contributions', 'penalty_withdrawals', 'donation_withdrawals', 'operational_withdrawals'])[floor(random() * 4 + 1)],
  (ARRAY['Member A', 'Member B', 'Vendor X', 'Service Y'])[floor(random() * 4 + 1)],
  '254' || LPAD((floor(random() * 900000000 + 100000000))::text, 9, '0'),
  (ARRAY[5000, 10000, 15000, 20000, 25000])[floor(random() * 5 + 1)],
  (ARRAY[0, 50, 100, 150])[floor(random() * 4 + 1)],
  (ARRAY[0, 100, 200, 300])[floor(random() * 4 + 1)],
  (ARRAY[4850, 9850, 14850, 19850, 24850])[floor(random() * 5 + 1)],
  (ARRAY[100000, 200000, 300000, 400000, 500000])[floor(random() * 5 + 1)],
  'TXN' || LPAD((floor(random() * 999999))::text, 6, '0'),
  'completed',
  NOW() - (INTERVAL '1 day' * floor(random() * 30))
FROM generate_series(1, 25)
ON CONFLICT DO NOTHING;

-- Insert mock B2C transactions
INSERT INTO b2c_transactions (withdrawal_id, amount, phone_number, mpesa_charge, status, initiated_at, completed_at)
SELECT 
  pw.id,
  pw.amount,
  pw.phone_number,
  ROUND(pw.amount * 0.01)::numeric,
  'completed',
  pw.created_at,
  pw.created_at + INTERVAL '5 minutes'
FROM penalty_withdrawals pw
WHERE pw.status = 'completed'
LIMIT 5
ON CONFLICT DO NOTHING;

-- Verify data was inserted
SELECT 'Penalty Wallet' as wallet, total_balance FROM penalty_wallet
UNION ALL
SELECT 'Donation Wallet', total_balance FROM donation_wallet
UNION ALL
SELECT 'Operational Wallet', total_balance FROM operational_wallet;

SELECT 'Penalty Withdrawals' as type, COUNT(*) as count FROM penalty_withdrawals
UNION ALL
SELECT 'Donation Withdrawals', COUNT(*) FROM donation_withdrawals
UNION ALL
SELECT 'Operational Withdrawals', COUNT(*) FROM operational_withdrawals
UNION ALL
SELECT 'Expenses', COUNT(*) FROM expenses
UNION ALL
SELECT 'Contributions', COUNT(*) FROM contributions
UNION ALL
SELECT 'Wallet Transactions', COUNT(*) FROM wallet_transactions;
