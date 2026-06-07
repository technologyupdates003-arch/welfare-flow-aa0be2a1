ALTER TABLE public.donation_campaigns
  ADD COLUMN IF NOT EXISTS goal_type text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS target_total numeric,
  ADD COLUMN IF NOT EXISTS allow_partial boolean NOT NULL DEFAULT true;