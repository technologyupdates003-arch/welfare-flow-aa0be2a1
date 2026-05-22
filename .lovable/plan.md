# Unified Treasury & Operational Wallet System

A large, multi-part enhancement. I'll deliver it in clearly-scoped phases so we can verify each piece works against real data before moving on.

## Goal

One unified outgoing-money engine (same approval, signatory, B2C, and receipt flow as the existing Penalty / Fund Drive withdrawals) used by **every** payout in the system — Trigger Payout, Expenses, and a new Operational Wallet — with real-time wallet statements, Safaricom cost tracking, and a consolidated Treasurer report.

---

## Phase 1 — Database foundation (migration)

New tables / columns:

- `operational_wallet` — same shape as `penalty_wallet` / `donation_wallet` (`total_received`, `total_withdrawn`, `total_balance`, `updated_at`). Single row, seeded at 0.
- `operational_payment_records` — C2B + manual top-ups (mirrors `penalty_payment_records`).
- `operational_withdrawals` — mirrors `penalty_withdrawals` (+ `wallet_type`, `category` so it can also represent an expense, + `recipient_name`, `expense_type`).
- `operational_withdrawal_signatories` — mirrors `donation_withdrawal_signatories`.
- `wallet_transactions` (NEW unified ledger): `id, wallet_type ('penalty'|'donation'|'operational'), direction ('in'|'out'), source ('c2b'|'b2c'|'topup'|'expense'|'transfer'), reference_id (uuid), reference_table, party_name, party_phone, gross_amount, mpesa_charge, system_fee, net_amount, running_balance, mpesa_receipt, status, occurred_at`. This is the single source of truth for statements + reports.
- `b2c_transactions`: add `mpesa_charge numeric default 0`, `working_account_funds numeric`, `utility_account_funds numeric`, `transaction_completed_at` (parsed from Daraja `ResultParameters`).
- `expenses`: add `wallet_type`, `withdrawal_id` (FK to `operational_withdrawals`), `mpesa_charge`.
- New enum value `'operational'` wherever wallet_type is referenced.
- RLS: treasurer + admin + super_admin manage everything; chairperson/secretary/treasurer can view + approve as signatories (same pattern as donation wallet).

## Phase 2 — Unified transaction engine (edge functions)

- Refactor `b2c-transfer` → accept `walletType: 'penalty'|'donation'|'operational'` (already does penalty/donation, extend for operational). On success, parse Daraja `ResultParameters` for `B2CChargesPaidAccountAvailableFunds`, `B2CWorkingAccountAvailableFunds`, and `TransactionAmount` to capture real M-Pesa charges; persist into `b2c_transactions.mpesa_charge` and into `wallet_transactions`.
- New edge function `wallet-ledger-write` — internal helper invoked from triggers/edge functions to insert a `wallet_transactions` row with computed `running_balance`. Used by C2B verify, B2C completion, expense payout, transfers.
- New edge function `operational-topup` — supports two flows: (a) STK push C2B into operational wallet (reusing existing `mpesa-stk-push`) and (b) manual ledger top-up entry (treasurer records cash/bank deposit).
- Update STK / C2B webhooks to write to `wallet_transactions` and respect target `wallet_type`.

## Phase 3 — Shared signatory + approval UI

- Extract `<SignatoryApprovalCard />` from current penalty/donation flow into `src/components/withdrawal/SignatoryApprovalPanel.tsx`. Shows full name, profile photo, signature image, status, timestamp — pulled live from `members` + `office_bearer_signatures`.
- Extract `useWithdrawalApproval(walletType, withdrawalId)` hook that handles: load signatories, approve/reject, detect "all approved" → call `b2c-transfer` with correct `walletType`. Replaces duplicated logic across penalty/donation pages.
- Wire the existing `/admin/withdrawal-approval` page to merge in operational withdrawals too (one inbox for treasurer/chairperson/secretary).

## Phase 4 — Treasurer dashboard UI

- **Operational Wallet page** (`/treasurer/operational-wallet`): balance card, "Top Up (STK / Record Deposit)" button, "Withdraw / Payout" button (uses same WithdrawalRequest form as penalty wallet), statement tab.
- **Trigger Payout page**: add `Source Wallet` dropdown (Penalty / Fund Drive / Operational). Submitting creates a withdrawal in the correct table → standard signatory flow → B2C.
- **Expenses page**: add `Source Wallet` dropdown + "Pay via B2C" toggle. When toggled, creates an `operational_withdrawals` row (category=expense) instead of a free-text expense, then routes through the same approval engine. Cash/bank expenses keep current behavior but still log to `wallet_transactions` for the chosen wallet.
- **Wallet Statement component** (`<WalletStatement walletType=... />`): real-time list from `wallet_transactions` via Supabase channel subscription. Columns: date/time, type, party, gross, M-Pesa charge, net, running balance, status, reference, M-Pesa receipt. Reused by all three wallets.

## Phase 5 — Consolidated Treasurer Report

- New page `/treasurer/reports` with filters: date range (preset + custom), wallet type (all/penalty/donation/operational), transaction type, status.
- Pulls live from `wallet_transactions` + joined source tables. Sections:
  - Penalty: contributions, withdrawals
  - Fund Drive: contributions, withdrawals
  - Operational: top-ups, payouts, expenses, transfers
  - Expenses summary (all wallets)
  - Fees: total Safaricom charges, system fees
  - Net cash position per wallet
- Export: PDF (branded with letterhead + stamp, same generator used for memos), Excel (`xlsx`), CSV.

## Phase 6 — Real-time

All wallet pages, statements, approval inbox, and reports subscribe via `supabase.channel(...).on('postgres_changes', ...)` to: `wallet_transactions`, `b2c_transactions`, `*_withdrawals`, `*_withdrawal_signatories`, and the three wallet tables. Enable `REPLICA IDENTITY FULL` + add to `supabase_realtime` publication in the migration.

---

## Technical details

- No bypass: edge functions verify `all signatories approved` server-side before calling Daraja, even if UI says so.
- `running_balance` computed in DB via trigger on `wallet_transactions` insert (locks wallet row, reads current balance, writes).
- M-Pesa charge extraction: Daraja B2C `ResultParameters` array — pull by `Key === 'B2CChargesPaidAccountAvailableFunds'` (delta vs previous) **or** the simpler `TransactionReceipt`-paired `Charge` when present; fall back to 0 if sandbox doesn't return it (sandbox usually returns 0 charge).
- Migrations split per concern; no destructive changes to existing data. Existing penalty/donation flows keep working unchanged — they just additionally write to `wallet_transactions`.

---

## What I'll need from you to start

This is ~3-5 hours of focused work. Two questions before I begin:

1. **Operational Wallet M-Pesa shortcode** — should it use the same sandbox shortcode as the others (currently `600000`), or do you have a separate paybill/till for daily ops? In production you'd typically want a separate one. For now I'll default to the same sandbox shortcode and you can override later via secrets.
2. **Expenses paid by cash/bank** (non-B2C) — should they still require all signatories to approve, or only B2C payouts go through the full signatory chain and cash entries are recorded directly by the treasurer? My recommendation: **all** outgoing >= a threshold (configurable, default KES 5,000) need full signatory approval, smaller cash expenses just need treasurer + one co-signer. Confirm or override.

Once you answer (or say "use your defaults"), I'll start with Phase 1 migration.
