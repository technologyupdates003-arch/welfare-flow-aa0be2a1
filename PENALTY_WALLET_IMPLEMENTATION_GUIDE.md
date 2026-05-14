# PENALTY WALLET SYSTEM - IMPLEMENTATION GUIDE

## Overview

The enhanced penalty wallet system allows members to pay penalties via M-Pesa STK Push, with all payments going into a centralized penalty wallet. Admins can then request withdrawals that require approval from three signatories (Chairperson, Secretary, and Treasurer) before funds are released.

---

## SYSTEM ARCHITECTURE

### 1. MEMBER PENALTY PAYMENT FLOW

```
Member Views Penalties
    ↓
Selects Penalties to Pay
    ↓
Enters M-Pesa Phone Number
    ↓
STK Push Initiated
    ↓
Member Enters M-Pesa PIN
    ↓
Payment Verified
    ↓
Penalty Marked as Paid
    ↓
Amount Added to Penalty Wallet
```

### 2. ADMIN WITHDRAWAL FLOW

```
Admin Requests Withdrawal
    ↓
Specifies Amount & Reason
    ↓
Withdrawal Request Created
    ↓
Signatories Notified
    ↓
Chairperson Reviews & Approves/Rejects
    ↓
Secretary Reviews & Approves/Rejects
    ↓
Treasurer Reviews & Approves/Rejects
    ↓
If All Approved → Withdrawal Completed
    ↓
Receipt PDF Generated with All Signatures
    ↓
Signatories Receive Receipt
```

---

## DATABASE SCHEMA

### New Tables

#### 1. **penalty_wallet**
Stores the central penalty wallet balance.

```sql
- id: UUID (PK)
- total_balance: NUMERIC (current available balance)
- total_received: NUMERIC (cumulative received)
- total_withdrawn: NUMERIC (cumulative withdrawn)
- last_updated: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
```

#### 2. **penalty_payment_records**
Records individual penalty payments from members.

```sql
- id: UUID (PK)
- member_id: UUID (FK to members)
- penalty_id: UUID (FK to penalties, nullable)
- amount: NUMERIC
- payment_ref: TEXT (M-Pesa receipt number)
- mpesa_transaction_id: TEXT (STK Push checkout request ID)
- status: TEXT (pending|verified|failed)
- verified_by: UUID (FK to auth.users, nullable)
- verified_at: TIMESTAMPTZ (nullable)
- created_at, updated_at: TIMESTAMPTZ
```

#### 3. **penalty_withdrawals**
Withdrawal requests from the penalty wallet.

```sql
- id: UUID (PK)
- amount: NUMERIC
- reason: TEXT
- requested_by: UUID (FK to auth.users)
- status: withdrawal_status (pending|submitted|approved|rejected|completed|cancelled)
- submitted_at: TIMESTAMPTZ (when submitted for approval)
- completed_at: TIMESTAMPTZ (when withdrawal completed)
- receipt_url: TEXT (URL to receipt PDF)
- created_at, updated_at: TIMESTAMPTZ
```

#### 4. **withdrawal_signatories**
Tracks approval status from each required signatory.

```sql
- id: UUID (PK)
- withdrawal_id: UUID (FK to penalty_withdrawals)
- signatory_role: TEXT (chairperson|secretary|treasurer)
- signatory_user_id: UUID (FK to auth.users, nullable)
- status: signatory_status (pending|approved|rejected)
- signature_url: TEXT (digital signature image)
- rejection_reason: TEXT (nullable)
- approved_at: TIMESTAMPTZ (nullable)
- rejected_at: TIMESTAMPTZ (nullable)
- created_at, updated_at: TIMESTAMPTZ
- UNIQUE(withdrawal_id, signatory_role)
```

#### 5. **withdrawal_receipts**
Stores generated receipt PDFs.

```sql
- id: UUID (PK)
- withdrawal_id: UUID (FK to penalty_withdrawals)
- receipt_pdf_url: TEXT
- generated_at: TIMESTAMPTZ
- created_at: TIMESTAMPTZ
```

---

## COMPONENTS & PAGES

### 1. Member: Pay Penalty Page (`/member/pay-penalty`)

**File:** `src/pages/member/PayPenalty.tsx`

**Features:**
- Display all unpaid penalties
- Auto-select all penalties by default
- Show total amount to pay
- Phone number input with formatting
- STK Push initiation
- Payment status polling
- Real-time feedback

**Key Functions:**
- `initiatePenaltySTKPush()` - Initiates M-Pesa payment
- `formatPhoneNumber()` - Formats phone to M-Pesa format
- `pollPaymentStatus()` - Polls for payment verification

**UI Elements:**
- Penalty list with checkboxes
- Select/Deselect all button
- Phone number input
- Payment summary card
- STK Push button
- Status alerts

### 2. Admin: Penalty Wallet Page (`/admin/penalty-wallet`)

**File:** `src/pages/admin/PenaltyWallet.tsx`

**Features:**
- Display wallet balance (total, received, withdrawn)
- Request withdrawal dialog
- View withdrawal requests with signatory status
- View recent penalty payments
- Track payment verification

**Key Functions:**
- `handleWithdrawalRequest()` - Submit withdrawal request
- Auto-create signatory records for three roles

**UI Elements:**
- Balance cards (total, received, withdrawn)
- Withdrawal request button
- Withdrawal requests list
- Recent payments table
- Signatory status badges

### 3. Admin: Withdrawal Approval Page (`/admin/withdrawal-approval`)

**File:** `src/pages/admin/WithdrawalApproval.tsx`

**Features:**
- View pending withdrawals for current user's role
- Approve or reject withdrawals
- Add rejection reason
- View all signatories' status
- Real-time status updates

**Key Functions:**
- `handleApproval()` - Process approval/rejection
- Auto-check if all signatories approved
- Auto-update withdrawal status

**UI Elements:**
- Pending approvals count
- Withdrawal cards with details
- Signatory status display
- Approve/Reject buttons
- Approval dialog with reason input

---

## SERVICES & UTILITIES

### STK Push Service (`src/lib/stkpush.ts`)

**Functions:**

1. **initiatePenaltySTKPush()**
   - Calls Supabase Edge Function
   - Creates penalty payment record
   - Returns checkout request ID

2. **formatPhoneNumber()**
   - Converts phone to M-Pesa format (254XXXXXXXXX)
   - Handles various input formats

3. **processSTKPushCallback()**
   - Processes M-Pesa callback
   - Updates payment record
   - Marks as verified

4. **getPaymentStatus()**
   - Queries payment status
   - Returns current status and amount

---

## SUPABASE EDGE FUNCTIONS

### 1. coop-stk-push (Existing)
Initiates M-Pesa STK Push payment.

**Request:**
```json
{
  "phoneNumber": "254712345678",
  "amount": 5000,
  "accountReference": "PENALTY-member-id",
  "transactionDesc": "Penalty Payment",
  "callbackUrl": "https://app.com/api/sms-webhook",
  "paymentType": "penalty",
  "memberId": "member-uuid",
  "penaltyIds": ["penalty-uuid-1", "penalty-uuid-2"]
}
```

**Response:**
```json
{
  "ResponseCode": "0",
  "ResponseDescription": "Success",
  "MerchantRequestID": "...",
  "CheckoutRequestID": "..."
}
```

### 2. generate-withdrawal-receipt (New)
Generates PDF receipt with all signatures.

**File:** `supabase/functions/generate-withdrawal-receipt/index.ts`

**Request:**
```json
{
  "withdrawalId": "withdrawal-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "receiptUrl": "https://storage.url/receipt.pdf"
}
```

---

## DATABASE TRIGGERS & FUNCTIONS

### 1. update_penalty_wallet_balance()
Automatically updates wallet balance when payment is verified.

```sql
TRIGGER: penalty_payment_verified_trigger
ON: penalty_payment_records
WHEN: status changes to 'verified'
ACTION: Increment wallet balance and total_received
```

### 2. update_wallet_on_withdrawal()
Automatically updates wallet balance when withdrawal is completed.

```sql
TRIGGER: withdrawal_completed_trigger
ON: penalty_withdrawals
WHEN: status changes to 'completed'
ACTION: Decrement wallet balance and increment total_withdrawn
```

---

## ROW-LEVEL SECURITY (RLS) POLICIES

### penalty_payment_records
- Members can view own payments
- Admin/super_admin can view all
- Admin/super_admin can insert and update

### penalty_withdrawals
- Admin/super_admin can view all
- Signatories can view their assigned withdrawals

### withdrawal_signatories
- Signatories can view their assignments
- Admin/super_admin can view all
- Signatories can update their own status

### withdrawal_receipts
- Admin/super_admin can view all
- Signatories can view receipts for their withdrawals

---

## INTEGRATION STEPS

### 1. Database Setup
```bash
# Apply migration
supabase migration up

# Or manually run:
# supabase/migrations/20260512_penalty_wallet_system.sql
```

### 2. Storage Setup
Create storage bucket for receipts:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('withdrawal-receipts', 'withdrawal-receipts', true);
```

### 3. Update App Routes
Add to `src/App.tsx`:
```tsx
// Admin routes
<Route path="/admin/penalty-wallet" element={<AdminLayout><PenaltyWallet /></AdminLayout>} />
<Route path="/admin/withdrawal-approval" element={<AdminLayout><WithdrawalApproval /></AdminLayout>} />

// Member routes (already exists)
<Route path="/member/pay-penalty" element={<MemberLayout><PayPenalty /></MemberLayout>} />
```

### 4. Update Navigation
Add menu items to admin and member layouts:
```tsx
// Admin menu
<NavLink to="/admin/penalty-wallet" icon={<Wallet />}>
  Penalty Wallet
</NavLink>
<NavLink to="/admin/withdrawal-approval" icon={<CheckCircle />}>
  Withdrawal Approvals
</NavLink>

// Member menu
<NavLink to="/member/pay-penalty" icon={<CreditCard />}>
  Pay Penalties
</NavLink>
```

### 5. Environment Variables
Ensure these are set in `.env`:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

---

## WORKFLOW EXAMPLES

### Example 1: Member Pays Penalty

1. Member navigates to `/member/pay-penalty`
2. System loads all unpaid penalties (auto-selected)
3. Member enters phone number: `0712345678`
4. Member clicks "Pay KES 5,000"
5. STK Push sent to phone
6. Member enters M-Pesa PIN
7. Payment verified
8. Penalty marked as paid
9. Amount added to penalty wallet
10. Member sees success message

### Example 2: Admin Requests Withdrawal

1. Admin navigates to `/admin/penalty-wallet`
2. Admin clicks "Request Withdrawal"
3. Admin enters amount: `50,000`
4. Admin enters reason: "Office supplies purchase"
5. Admin clicks "Submit for Approval"
6. System creates withdrawal request
7. System creates signatory records for 3 roles
8. Signatories notified

### Example 3: Signatories Approve Withdrawal

**Chairperson:**
1. Navigates to `/admin/withdrawal-approval`
2. Sees pending withdrawal: KES 50,000
3. Reviews reason and amount
4. Clicks "Approve"
5. Status updated to "approved"

**Secretary:**
1. Same process as chairperson
2. Approves withdrawal

**Treasurer:**
1. Same process
2. Approves withdrawal
3. System detects all approved
4. Withdrawal status → "completed"
5. Wallet balance updated
6. Receipt PDF generated
7. All signatories receive receipt

---

## PAYMENT FLOW DETAILS

### STK Push Process

1. **Initiation**
   - Member submits payment request
   - System calls `coop-stk-push` function
   - M-Pesa sends prompt to phone

2. **User Action**
   - Member enters M-Pesa PIN
   - M-Pesa processes payment

3. **Callback**
   - M-Pesa sends callback to webhook
   - System processes callback
   - Payment record updated
   - Wallet balance updated

4. **Verification**
   - System polls payment status
   - Member sees real-time updates
   - Penalty marked as paid

---

## SECURITY CONSIDERATIONS

### 1. Authentication
- All operations require authentication
- RLS policies enforce access control
- Signatories verified by role

### 2. Authorization
- Members can only pay own penalties
- Admin can manage wallet
- Signatories can only approve their role

### 3. Data Integrity
- Triggers ensure wallet consistency
- Unique constraints prevent duplicates
- Audit trail via created_at/updated_at

### 4. Payment Security
- M-Pesa handles payment encryption
- Transaction IDs tracked
- Receipt URLs stored securely

---

## TESTING CHECKLIST

- [ ] Member can view unpaid penalties
- [ ] Member can select/deselect penalties
- [ ] Total amount calculates correctly
- [ ] Phone number formats correctly
- [ ] STK Push initiates successfully
- [ ] Payment status updates in real-time
- [ ] Penalty marked as paid after verification
- [ ] Wallet balance updates automatically
- [ ] Admin can request withdrawal
- [ ] Signatories receive notifications
- [ ] Signatories can approve/reject
- [ ] Withdrawal status updates correctly
- [ ] Receipt PDF generates successfully
- [ ] All signatories receive receipt
- [ ] Wallet balance reflects withdrawal

---

## TROUBLESHOOTING

### Payment Not Verified
- Check M-Pesa transaction status
- Verify phone number format
- Check callback webhook logs
- Ensure payment record exists

### Withdrawal Stuck in Pending
- Check signatory assignments
- Verify user roles
- Check RLS policies
- Review signatory status

### Receipt Not Generated
- Check storage bucket permissions
- Verify Edge Function logs
- Check receipt generation function
- Ensure withdrawal is completed

---

## FUTURE ENHANCEMENTS

1. **Email Notifications**
   - Send receipt to signatories
   - Notify member of payment confirmation

2. **SMS Notifications**
   - SMS confirmation of payment
   - SMS notification of withdrawal approval

3. **Advanced Reporting**
   - Penalty payment trends
   - Withdrawal history reports
   - Signatory approval metrics

4. **Batch Processing**
   - Batch penalty payments
   - Scheduled withdrawals
   - Automated reconciliation

5. **Integration**
   - Bank account integration
   - Accounting system sync
   - Audit trail export

---

## SUPPORT

For issues or questions:
1. Check logs in Supabase dashboard
2. Review RLS policies
3. Verify database triggers
4. Check Edge Function logs
5. Review payment callback logs
