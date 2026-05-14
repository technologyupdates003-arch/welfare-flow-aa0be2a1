-- Donation Campaign System
-- Allows admins to create donation campaigns with descriptions and targets

-- Create donation_campaigns table
CREATE TABLE IF NOT EXISTS public.donation_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  target_amount NUMERIC NOT NULL DEFAULT 0,
  collected_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add campaign_id to donation_payment_records to link donations to campaigns
ALTER TABLE public.donation_payment_records 
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.donation_campaigns(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.donation_campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for donation_campaigns
CREATE POLICY "Anyone authenticated can view active campaigns"
ON public.donation_campaigns FOR SELECT
TO authenticated
USING (status IN ('active', 'completed') OR created_by = auth.uid());

CREATE POLICY "Admin can view all campaigns"
ON public.donation_campaigns FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admin can create campaigns"
ON public.donation_campaigns FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admin can update campaigns"
ON public.donation_campaigns FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admin can delete campaigns"
ON public.donation_campaigns FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Create indexes for performance
CREATE INDEX idx_donation_campaigns_status ON public.donation_campaigns(status);
CREATE INDEX idx_donation_campaigns_created_by ON public.donation_campaigns(created_by);
CREATE INDEX idx_donation_campaigns_created_at ON public.donation_campaigns(created_at);
CREATE INDEX IF NOT EXISTS idx_donation_payment_records_campaign_id ON public.donation_payment_records(campaign_id);

-- Function to update campaign collected amount when payment is verified
CREATE OR REPLACE FUNCTION public.update_campaign_collected_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'verified' AND OLD.status != 'verified' AND NEW.campaign_id IS NOT NULL THEN
    UPDATE public.donation_campaigns 
    SET 
      collected_amount = collected_amount + NEW.amount,
      updated_at = now()
    WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to update campaign amount on payment verification
DROP TRIGGER IF EXISTS campaign_payment_verified_trigger ON public.donation_payment_records;
CREATE TRIGGER campaign_payment_verified_trigger
AFTER UPDATE ON public.donation_payment_records
FOR EACH ROW
EXECUTE FUNCTION public.update_campaign_collected_amount();

-- Verification queries
SELECT 'Donation Campaigns Table Created' as status;
SELECT COUNT(*) as campaign_count FROM public.donation_campaigns;
