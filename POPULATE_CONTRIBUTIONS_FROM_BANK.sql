-- Populate contributions table from bank_transactions
-- Run this in Supabase SQL Editor to backfill contributions

INSERT INTO public.contributions (member_id, amount, month, year, due_date, status, paid_date)
SELECT 
  bt.member_id,
  SUM(bt.amount) as amount,
  bt.month,
  bt.year,
  (bt.year || '-' || LPAD(bt.month::text, 2, '0') || '-05')::DATE as due_date,
  'paid' as status,
  MAX(bt.transaction_date)::DATE as paid_date
FROM public.bank_transactions bt
GROUP BY bt.member_id, bt.month, bt.year
ON CONFLICT (member_id, month, year) DO UPDATE
SET 
  amount = EXCLUDED.amount,
  status = 'paid',
  paid_date = EXCLUDED.paid_date;

-- Update members total_contributions
UPDATE public.members m
SET total_contributions = (
  SELECT COALESCE(SUM(amount), 0)
  FROM public.contributions c
  WHERE c.member_id = m.id AND c.status = 'paid'
);

SELECT 'Contributions populated successfully!' as result;
