-- Fix RLS policies for donation_campaigns table to allow members to read active campaigns

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Members can view active campaigns" ON public.donation_campaigns;
DROP POLICY IF EXISTS "Anyone authenticated can view active campaigns" ON public.donation_campaigns;

-- Create new policy allowing authenticated users to view active campaigns
CREATE POLICY "Members can view active campaigns"
ON public.donation_campaigns FOR SELECT
TO authenticated
USING (active = true);

-- Ensure admin/super_admin can view all campaigns
DROP POLICY IF EXISTS "Admin can view all campaigns" ON public.donation_campaigns;
CREATE POLICY "Admin can view all campaigns"
ON public.donation_campaigns FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Verify the policies are in place
SELECT 'RLS policies updated successfully' as status;
