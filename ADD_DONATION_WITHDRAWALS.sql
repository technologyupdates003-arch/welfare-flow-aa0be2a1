-- Donation wallet withdrawal schema
-- Similar to penalty withdrawals with signatory approvals

create table if not exists donation_withdrawals (
  id uuid primary key default gen_random_uuid(),
  amount numeric not null,
  reason text not null,
  status text not null default 'pending',
  requested_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  phone_number text
);

create table if not exists donation_withdrawal_signatories (
  id uuid primary key default gen_random_uuid(),
  withdrawal_id uuid references donation_withdrawals(id) on delete cascade,
  signatory_role text not null,
  signatory_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending',
  signature_url text,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add donation_wallet table to track balance
create table if not exists donation_wallet (
  id uuid primary key default gen_random_uuid(),
  total_balance numeric not null default 0,
  total_received numeric not null default 0,
  total_withdrawn numeric not null default 0,
  updated_at timestamptz not null default now()
);

-- Insert initial wallet record if not exists
insert into donation_wallet (id, total_balance, total_received, total_withdrawn)
select gen_random_uuid(), 0, 0, 0
where not exists (select 1 from donation_wallet);

-- Indexes
create index if not exists donation_withdrawals_status_idx on donation_withdrawals(status);
create index if not exists donation_withdrawals_requested_by_idx on donation_withdrawals(requested_by);
create index if not exists donation_withdrawal_signatories_withdrawal_id_idx on donation_withdrawal_signatories(withdrawal_id);
create index if not exists donation_withdrawal_signatories_role_idx on donation_withdrawal_signatories(signatory_role);

-- Enable RLS
alter table donation_withdrawals enable row level security;
alter table donation_withdrawal_signatories enable row level security;
alter table donation_wallet enable row level security;

-- RLS Policies for donation_withdrawals
create policy "Admins can view donation withdrawals" on donation_withdrawals
  for select using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role in ('admin', 'super_admin', 'chairperson', 'secretary', 'treasurer')
    )
  );

create policy "Admins can insert donation withdrawals" on donation_withdrawals
  for insert with check (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role in ('admin', 'super_admin')
    )
  );

create policy "Admins can update donation withdrawals" on donation_withdrawals
  for update using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role in ('admin', 'super_admin', 'chairperson', 'secretary', 'treasurer')
    )
  );

-- RLS Policies for donation_withdrawal_signatories
create policy "Signatories can view their withdrawal approvals" on donation_withdrawal_signatories
  for select using (
    signatory_user_id = auth.uid() or
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role in ('admin', 'super_admin', 'chairperson', 'secretary', 'treasurer')
    )
  );

create policy "Signatories can update their approvals" on donation_withdrawal_signatories
  for update using (
    signatory_user_id = auth.uid() or
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role in ('admin', 'super_admin')
    )
  );

create policy "Admins can insert withdrawal signatories" on donation_withdrawal_signatories
  for insert with check (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role in ('admin', 'super_admin')
    )
  );

-- RLS Policies for donation_wallet
create policy "Admins can view donation wallet" on donation_wallet
  for select using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role in ('admin', 'super_admin', 'chairperson', 'secretary', 'treasurer')
    )
  );

create policy "Admins can update donation wallet" on donation_wallet
  for update using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
      and role in ('admin', 'super_admin')
    )
  );