-- Delete all existing book balance records
DELETE FROM public.book_balance;

-- Reset sequence if exists
ALTER SEQUENCE book_balance_id_seq RESTART WITH 1;

SELECT 'Book balance table cleared' as status;
