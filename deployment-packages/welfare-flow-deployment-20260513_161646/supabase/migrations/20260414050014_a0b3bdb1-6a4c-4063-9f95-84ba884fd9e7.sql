
-- Create beneficiaries table
CREATE TABLE public.beneficiaries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text NOT NULL DEFAULT 'spouse',
  phone text,
  id_number text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own beneficiaries" ON public.beneficiaries
FOR SELECT TO authenticated
USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Members can add own beneficiaries" ON public.beneficiaries
FOR INSERT TO authenticated
WITH CHECK (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Members can update own beneficiaries" ON public.beneficiaries
FOR UPDATE TO authenticated
USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Members can delete own beneficiaries" ON public.beneficiaries
FOR DELETE TO authenticated
USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()));

CREATE POLICY "Admin can manage beneficiaries" ON public.beneficiaries
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add unique constraint on contributions for upsert
CREATE UNIQUE INDEX IF NOT EXISTS contributions_member_month_year_idx ON public.contributions (member_id, month, year);
