-- Clear all book balance records to re-import fresh data
-- Run this in Supabase SQL Editor before re-importing

DELETE FROM public.book_balance;

-- Reset the ID sequence to start from 1
ALTER SEQUENCE IF EXISTS book_balance_id_seq RESTART WITH 1;

-- Verify the table is empty
SELECT COUNT(*) as remaining_records FROM public.book_balance;
