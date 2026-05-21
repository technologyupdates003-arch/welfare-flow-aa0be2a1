-- Check what data currently exists in the database

SELECT 'Members' as table_name, COUNT(*) as count FROM public.members
UNION ALL
SELECT 'Penalties', COUNT(*) FROM public.penalties
UNION ALL
SELECT 'Penalty Payment Records', COUNT(*) FROM public.penalty_payment_records
UNION ALL
SELECT 'Donation Campaigns', COUNT(*) FROM public.donation_campaigns
UNION ALL
SELECT 'Donation Payment Records', COUNT(*) FROM public.donation_payment_records;
