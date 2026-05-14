-- Memos system
CREATE TABLE IF NOT EXISTS public.memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number VARCHAR(50) UNIQUE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  recipient_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  attachments TEXT[],
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.memo_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id UUID REFERENCES public.memos(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE NOT NULL,
  delivered_at TIMESTAMPTZ,
  seen_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(memo_id, member_id)
);

CREATE TABLE IF NOT EXISTS public.memo_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  template_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.generate_memo_reference()
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE y TEXT; c INTEGER;
BEGIN
  y := TO_CHAR(now(), 'YYYY');
  SELECT COUNT(*) INTO c FROM public.memos WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM now());
  RETURN 'KHCWW-MEMO-' || y || '-' || LPAD((c+1)::TEXT, 3, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.set_memo_reference()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.reference_number IS NULL OR NEW.reference_number = '' THEN
    NEW.reference_number := public.generate_memo_reference();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trigger_set_memo_reference ON public.memos;
CREATE TRIGGER trigger_set_memo_reference
  BEFORE INSERT ON public.memos
  FOR EACH ROW EXECUTE FUNCTION public.set_memo_reference();

ALTER TABLE public.memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memo_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memo_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Treasurer can view memos" ON public.memos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('treasurer','admin','super_admin')));
CREATE POLICY "Treasurer can create memos" ON public.memos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('treasurer','admin','super_admin')));
CREATE POLICY "Treasurer can update memos" ON public.memos FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('treasurer','admin','super_admin')));
CREATE POLICY "Treasurer can delete draft memos" ON public.memos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('treasurer','admin','super_admin')) AND status='draft');
CREATE POLICY "Members can view their memos" ON public.memos FOR SELECT TO authenticated
  USING (id IN (SELECT memo_id FROM memo_recipients WHERE member_id IN (SELECT id FROM members WHERE user_id = auth.uid())));

CREATE POLICY "Treasurer manage recipients" ON public.memo_recipients FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('treasurer','admin','super_admin')));
CREATE POLICY "Members view own receipts" ON public.memo_recipients FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));
CREATE POLICY "Members update own tracking" ON public.memo_recipients FOR UPDATE TO authenticated
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "Treasurer manage templates" ON public.memo_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('treasurer','admin','super_admin')));

CREATE INDEX IF NOT EXISTS idx_memos_status ON public.memos(status);
CREATE INDEX IF NOT EXISTS idx_memos_created ON public.memos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memo_recipients_memo ON public.memo_recipients(memo_id);
CREATE INDEX IF NOT EXISTS idx_memo_recipients_member ON public.memo_recipients(member_id);