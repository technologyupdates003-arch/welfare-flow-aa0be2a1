
-- Enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- Welfare settings (single row)
CREATE TABLE public.welfare_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Welfare Group',
  monthly_contribution_amount NUMERIC NOT NULL DEFAULT 500,
  contribution_due_day INTEGER NOT NULL DEFAULT 5,
  penalty_amount NUMERIC NOT NULL DEFAULT 100,
  penalty_grace_days INTEGER NOT NULL DEFAULT 7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Members table
CREATE TABLE public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  member_id TEXT,
  total_contributions NUMERIC NOT NULL DEFAULT 0,
  total_penalties NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Contributions table
CREATE TABLE public.contributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  payment_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, month, year)
);
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;

-- Payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  transaction_ref TEXT,
  source TEXT NOT NULL DEFAULT 'bank_sms',
  matched BOOLEAN NOT NULL DEFAULT false,
  raw_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Penalties table
CREATE TABLE public.penalties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  contribution_id UUID REFERENCES public.contributions(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  reason TEXT NOT NULL DEFAULT 'Late payment',
  is_paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.penalties ENABLE ROW LEVEL SECURITY;

-- SMS logs
CREATE TABLE public.sms_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Unmatched payments
CREATE TABLE public.unmatched_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  raw_message TEXT,
  extracted_phone TEXT,
  extracted_amount NUMERIC,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.unmatched_payments ENABLE ROW LEVEL SECURITY;

-- Messages (group chat)
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- News & events
CREATE TABLE public.news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

-- Notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  type TEXT NOT NULL DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_welfare_settings_updated_at BEFORE UPDATE ON public.welfare_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contributions_updated_at BEFORE UPDATE ON public.contributions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_news_updated_at BEFORE UPDATE ON public.news FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS POLICIES

-- user_roles: admin can see all, users see own
CREATE POLICY "Admin can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- welfare_settings: admin can manage, all authenticated can read
ALTER TABLE public.welfare_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read settings" ON public.welfare_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage settings" ON public.welfare_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- members: admin sees all, members see own
CREATE POLICY "Admin can manage members" ON public.members FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Members can view own profile" ON public.members FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- contributions: admin sees all, members see own
CREATE POLICY "Admin can manage contributions" ON public.contributions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Members view own contributions" ON public.contributions FOR SELECT TO authenticated USING (
  member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
);

-- payments: admin sees all, members see own
CREATE POLICY "Admin can manage payments" ON public.payments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Members view own payments" ON public.payments FOR SELECT TO authenticated USING (
  member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
);

-- penalties: admin sees all, members see own
CREATE POLICY "Admin can manage penalties" ON public.penalties FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Members view own penalties" ON public.penalties FOR SELECT TO authenticated USING (
  member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
);

-- sms_logs: admin only
CREATE POLICY "Admin can manage sms_logs" ON public.sms_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- unmatched_payments: admin only
CREATE POLICY "Admin can manage unmatched" ON public.unmatched_payments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- messages: all authenticated
CREATE POLICY "Anyone can read messages" ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- news: admin can manage, all can read
CREATE POLICY "Anyone can read news" ON public.news FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage news" ON public.news FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- notifications: users see own
CREATE POLICY "Users see own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin can create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

-- Insert default welfare settings
INSERT INTO public.welfare_settings (name, monthly_contribution_amount, contribution_due_day, penalty_amount, penalty_grace_days)
VALUES ('Welfare Group', 500, 5, 100, 7);

-- Indexes
CREATE INDEX idx_members_phone ON public.members(phone);
CREATE INDEX idx_members_user_id ON public.members(user_id);
CREATE INDEX idx_contributions_member_id ON public.contributions(member_id);
CREATE INDEX idx_contributions_status ON public.contributions(status);
CREATE INDEX idx_payments_member_id ON public.payments(member_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
