-- CLEAR BOOK BALANCE TABLE
-- This script removes all incorrect records that were imported with Credit amounts
-- After running this, re-import your Excel file and only the 1 Debit row will be imported

DELETE FROM public.book_balance;

-- Verify it's empty
SELECT COUNT(*) as remaining_records FROM public.book_balance;
