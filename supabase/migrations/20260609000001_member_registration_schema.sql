-- New Member Registration Schema
-- This migration creates tables for member registration, payment tracking, and admin configuration

-- 1. Registration Configuration Table
CREATE TABLE IF NOT EXISTS registration_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retiring_date date NOT NULL,
  registration_fee integer NOT NULL DEFAULT 1000,
  active boolean DEFAULT true,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Member Registrations Table
CREATE TABLE IF NOT EXISTS member_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone_number text NOT NULL,
  department text NOT NULL,
  working_location text NOT NULL,
  date_of_birth date,
  status text CHECK (status IN ('pending', 'payment_pending', 'verified', 'approved', 'rejected', 'active')) DEFAULT 'pending',
  payment_status text CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'verified', 'failed')) DEFAULT 'unpaid',
  mpesa_transaction_ref text,
  approval_notes text,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now(),
  verified_at timestamp with time zone,
  approved_at timestamp with time zone,
  approved_by uuid REFERENCES auth.users(id),
  expires_at timestamp with time zone DEFAULT (now() + interval '7 days'),
  UNIQUE(phone_number, created_at::date)
);

-- 3. Registration Fees Payment Tracking Table
CREATE TABLE IF NOT EXISTS registration_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES member_registrations(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  phone_number text NOT NULL,
  mpesa_transaction_id text,
  mpesa_checkout_request_id text,
  status text CHECK (status IN ('pending', 'paid', 'failed')) DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  verified_at timestamp with time zone,
  retry_count integer DEFAULT 0,
  last_retry_at timestamp with time zone,
  error_message text
);

-- 4. Registration Access Links (JWT tokens for system access)
CREATE TABLE IF NOT EXISTS registration_access_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES member_registrations(id) ON DELETE CASCADE,
  access_token text NOT NULL UNIQUE,
  temporary_password text NOT NULL,
  used boolean DEFAULT false,
  used_at timestamp with time zone,
  expires_at timestamp with time zone DEFAULT (now() + interval '24 hours'),
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_member_registrations_phone ON member_registrations(phone_number);
CREATE INDEX IF NOT EXISTS idx_member_registrations_status ON member_registrations(status);
CREATE INDEX IF NOT EXISTS idx_member_registrations_created ON member_registrations(created_at);
CREATE INDEX IF NOT EXISTS idx_registration_fees_registration_id ON registration_fees(registration_id);
CREATE INDEX IF NOT EXISTS idx_registration_fees_phone ON registration_fees(phone_number);
CREATE INDEX IF NOT EXISTS idx_registration_access_token ON registration_access_links(access_token);

-- Enable Row Level Security
ALTER TABLE registration_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_access_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for registration_config (public read)
CREATE POLICY "Allow public read registration_config"
ON registration_config FOR SELECT
USING (true);

CREATE POLICY "Allow admin update registration_config"
ON registration_config FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = auth.uid()
    AND m.role IN ('admin', 'super_admin')
  )
);

-- RLS Policies for member_registrations
CREATE POLICY "Allow users read own registration"
ON member_registrations FOR SELECT
USING (
  phone_number = current_setting('app.phone_number', true)::text
  OR auth.uid() IN (
    SELECT id FROM public.members WHERE role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Allow anyone insert registration"
ON member_registrations FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow admin update registration"
ON member_registrations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = auth.uid()
    AND m.role IN ('admin', 'super_admin')
  )
);

-- RLS Policies for registration_fees
CREATE POLICY "Allow read own registration fees"
ON registration_fees FOR SELECT
USING (
  registration_id IN (
    SELECT id FROM member_registrations mr
    WHERE mr.phone_number = current_setting('app.phone_number', true)::text
  )
  OR EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = auth.uid()
    AND m.role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Allow insert registration fees"
ON registration_fees FOR INSERT
WITH CHECK (true);

-- RLS Policies for registration_access_links
CREATE POLICY "Allow read own access link"
ON registration_access_links FOR SELECT
USING (
  registration_id IN (
    SELECT id FROM member_registrations mr
    WHERE mr.phone_number = current_setting('app.phone_number', true)::text
  )
);

-- Insert default registration config if not exists
INSERT INTO registration_config (retiring_date, registration_fee, active)
SELECT '2027-12-31'::date, 1000, true
WHERE NOT EXISTS (SELECT 1 FROM registration_config);
