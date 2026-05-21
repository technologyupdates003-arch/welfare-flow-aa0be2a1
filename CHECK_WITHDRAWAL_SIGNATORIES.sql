-- Check if penalty and donation withdrawals have signatories

SELECT 'Penalty Withdrawals' as type, COUNT(*) as count FROM public.penalty_withdrawals;

SELECT 'Penalty Withdrawal Signatories' as type, COUNT(*) as count FROM public.withdrawal_signatories;

SELECT 'Donation Withdrawals' as type, COUNT(*) as count FROM public.donation_withdrawals;

SELECT 'Donation Withdrawal Signatories' as type, COUNT(*) as count FROM public.donation_withdrawal_signatories;

-- Show penalty withdrawals with their signatories
SELECT 
  pw.id as withdrawal_id,
  pw.amount,
  pw.reason,
  pw.status,
  COUNT(ws.id) as signatory_count,
  STRING_AGG(ws.signatory_role, ', ') as roles
FROM public.penalty_withdrawals pw
LEFT JOIN public.withdrawal_signatories ws ON pw.id = ws.withdrawal_id
GROUP BY pw.id, pw.amount, pw.reason, pw.status
ORDER BY pw.created_at DESC
LIMIT 10;

-- Show donation withdrawals with their signatories
SELECT 
  dw.id as withdrawal_id,
  dw.amount,
  dw.reason,
  dw.status,
  COUNT(dws.id) as signatory_count,
  STRING_AGG(dws.signatory_role, ', ') as roles
FROM public.donation_withdrawals dw
LEFT JOIN public.donation_withdrawal_signatories dws ON dw.id = dws.withdrawal_id
GROUP BY dw.id, dw.amount, dw.reason, dw.status
ORDER BY dw.created_at DESC
LIMIT 10;
