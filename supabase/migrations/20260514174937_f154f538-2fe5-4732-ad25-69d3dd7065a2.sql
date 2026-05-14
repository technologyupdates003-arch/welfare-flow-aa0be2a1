-- Generic increment helper used by withdrawal completion + donation crediting
CREATE OR REPLACE FUNCTION public.increment(
  table_name text,
  row_id uuid,
  amount numeric,
  field_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF table_name NOT IN ('penalty_wallet','donation_wallet') THEN
    RAISE EXCEPTION 'invalid table %', table_name;
  END IF;
  IF field_name NOT IN ('total_received','total_withdrawn','total_balance') THEN
    RAISE EXCEPTION 'invalid field %', field_name;
  END IF;
  EXECUTE format(
    'UPDATE public.%I SET %I = COALESCE(%I,0) + $1, updated_at = now() WHERE id = $2',
    table_name, field_name, field_name
  ) USING amount, row_id;

  -- Keep total_balance in sync when received/withdrawn change
  IF field_name = 'total_received' THEN
    EXECUTE format('UPDATE public.%I SET total_balance = COALESCE(total_balance,0) + $1 WHERE id = $2', table_name)
      USING amount, row_id;
  ELSIF field_name = 'total_withdrawn' THEN
    EXECUTE format('UPDATE public.%I SET total_balance = COALESCE(total_balance,0) - ABS($1) WHERE id = $2', table_name)
      USING amount, row_id;
  END IF;
END;
$$;

-- Ensure a single donation_wallet row exists
INSERT INTO public.donation_wallet (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.donation_wallet);

-- Trigger to credit donation wallet when a donation payment is verified
CREATE OR REPLACE FUNCTION public.update_donation_wallet_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'verified' AND COALESCE(OLD.status,'') <> 'verified' THEN
    UPDATE public.donation_wallet
       SET total_received = COALESCE(total_received,0) + NEW.amount,
           total_balance  = COALESCE(total_balance,0) + NEW.amount,
           updated_at = now()
     WHERE id = (SELECT id FROM public.donation_wallet LIMIT 1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS donation_payment_verified_trigger ON public.donation_payment_records;
CREATE TRIGGER donation_payment_verified_trigger
AFTER UPDATE ON public.donation_payment_records
FOR EACH ROW EXECUTE FUNCTION public.update_donation_wallet_balance();