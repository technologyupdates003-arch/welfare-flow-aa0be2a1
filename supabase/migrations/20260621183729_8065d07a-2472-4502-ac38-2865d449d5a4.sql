-- Bank statement imported transactions (transaction-level history + dedup source of truth)
CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  phone text NOT NULL,
  name text,
  amount numeric NOT NULL,
  transaction_date date NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  transaction_reference text NOT NULL,
  mpesa_code text,
  raw_details text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Prevent duplicate imports: phone + reference + date + amount must be unique
CREATE UNIQUE INDEX IF NOT EXISTS bank_transactions_dedup_idx
  ON public.bank_transactions (phone, transaction_reference, transaction_date, amount);

CREATE INDEX IF NOT EXISTS bank_transactions_member_idx ON public.bank_transactions (member_id);
CREATE INDEX IF NOT EXISTS bank_transactions_month_year_idx ON public.bank_transactions (year, month);

GRANT SELECT ON public.bank_transactions TO authenticated;
GRANT ALL ON public.bank_transactions TO service_role;

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

-- Authenticated users (treasurers/admins viewing dashboards) can read transactions
CREATE POLICY "Authenticated can view bank transactions"
  ON public.bank_transactions
  FOR SELECT
  TO authenticated
  USING (true);