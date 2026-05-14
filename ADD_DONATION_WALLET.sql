-- Donation wallet schema for STK push donation requests
-- Create a donation campaign table and payment tracking records.

create table if not exists donation_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  amount numeric not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists donation_payment_records (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references donation_campaigns(id) on delete set null,
  member_id uuid references members(id) on delete cascade,
  amount numeric not null,
  status text not null default 'pending',
  mpesa_transaction_id text,
  payment_ref text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists donation_campaigns_active_idx on donation_campaigns(active);
create index if not exists donation_payment_records_member_idx on donation_payment_records(member_id);
create index if not exists donation_payment_records_mpesa_id_idx on donation_payment_records(mpesa_transaction_id);
