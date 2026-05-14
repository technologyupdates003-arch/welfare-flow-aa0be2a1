# PENALTY WALLET SYSTEM - QUICK START GUIDE

## What's New?

Enhanced penalty payment system with:
- ✅ M-Pesa STK Push for member payments
- ✅ Centralized penalty wallet
- ✅ Multi-signatory withdrawal approval (Chairperson, Secretary, Treasurer)
- ✅ Automatic receipt generation with signatures
- ✅ Real-time payment verification

---

## QUICK SETUP (5 MINUTES)

### Step 1: Apply Database Migration
```bash
# Copy migration file to supabase/migrations/
# File: supabase/migrations/20260512_penalty_wallet_system.sql

# Apply migration
supabase migration up
```

### Step 2: Create Storage Bucket
```sql
-- Run in Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('withdrawal-receipts', 'withdrawal-receipts', true);
```

### Step 3: Copy Files to Project
```bash
# Copy these files to your project:
src/lib/stkpush.ts                              # STK Push service
src/pages/member/PayPenalty.tsx                 # Member penalty payment page
src/pages/admin/PenaltyWallet.tsx               # Admin wallet management
src/pages/admin/WithdrawalApproval.tsx          # Signatory approval page
supabase/functions/generate-withdrawal-receipt/ # Receipt generation function
```

### Step 4: Update App Routes
In `src/App.tsx`, add these routes:

```tsx
// In admin routes section
<Route path="/admin/penalty-wallet" element={<AdminLayout><PenaltyWallet /></AdminLayout>} />
<Route path="/admin/withdrawal-approval" element={<AdminLayout><WithdrawalApproval /></AdminLayout>} />

// Member routes (already exists)
<Route path="/member/pay-penalty" element={<MemberLayout><PayPenalty /></MemberLayout>} />
```

### Step 5: Update Navigation
Add menu items to your layout components:

```tsx
// Admin layout
<NavLink to="/admin/penalty-wallet" icon={<Wallet />}>
  Penalty Wallet
</NavLink>
<NavLink to="/admin/withdrawal-approval" icon={<CheckCircle />}>
  Withdrawal Approvals
</NavLink>

// Member layout
<NavLink to="/member/pay-penalty" icon={<CreditCard />}>
  Pay Penalties
</NavLink>
```

### Step 6: Test the System
1. Login as member
2. Go to `/member/pay-penalty`
3. Select penalties and enter phone number
4. Initiate STK Push
5. Login as admin
6. Go to `/admin/penalty-wallet`
7. Request withdrawal
8. Login as chairperson/secretary/treasurer
9. Go to `/admin/withdrawal-approval`
10. Approve withdrawal

---

## USER FLOWS

### For Members: Pay Penalty

```
1. Navigate to "Pay Penalties" (Member Menu)
2. View all unpaid penalties (auto-selected)
3. Enter M-Pesa phone number
4. Click "Pay KES [amount]"
5. Receive STK Push on phone
6. Enter M-Pesa PIN
7. Payment verified automatically
8. See success message
9. Penalty marked as paid
```

### For Admin: Request Withdrawal

```
1. Navigate to "Penalty Wallet" (Admin Menu)
2. View wallet balance
3. Click "Request Withdrawal"
4. Enter amount and reason
5. Click "Submit for Approval"
6. Signatories notified
7. Wait for approvals
```

### For Signatories: Approve Withdrawal

```
1. Navigate to "Withdrawal Approvals" (Admin Menu)
2. View pending withdrawals
3. Review amount and reason
4. Click "Approve" or "Reject"
5. If reject, enter reason
6. Submit approval
7. System checks if all approved
8. If all approved, withdrawal completed
9. Receipt PDF generated
10. All signatories receive receipt
```

---

## KEY FEATURES

### Member Payment Page
- ✅ Display all unpaid penalties
- ✅ Auto-select all penalties
- ✅ Show total amount to pay
- ✅ Phone number input with formatting
- ✅ STK Push initiation
- ✅ Real-time payment status
- ✅ Success/error alerts

### Admin Wallet Page
- ✅ Display wallet balance (total, received, withdrawn)
- ✅ Request withdrawal dialog
- ✅ View withdrawal requests with status
- ✅ View recent penalty payments
- ✅ Track payment verification

### Signatory Approval Page
- ✅ View pending approvals for your role
- ✅ Approve or reject withdrawals
- ✅ Add rejection reason
- ✅ View all signatories' status
- ✅ Real-time status updates

---

## DATABASE TABLES

### New Tables Created:
1. **penalty_wallet** - Central wallet balance
2. **penalty_payment_records** - Individual payments
3. **penalty_withdrawals** - Withdrawal requests
4. **withdrawal_signatories** - Approval tracking
5. **withdrawal_receipts** - Receipt storage

### Automatic Triggers:
- Wallet balance updates on payment verification
- Wallet balance updates on withdrawal completion
- Signatory records auto-created on withdrawal request

---

## PAYMENT FLOW

```
Member Pays Penalty
    ↓
STK Push Sent to Phone
    ↓
Member Enters PIN
    ↓
M-Pesa Processes Payment
    ↓
Callback Received
    ↓
Payment Verified
    ↓
Penalty Marked as Paid
    ↓
Wallet Balance Updated
    ↓
Member Sees Success
```

---

## WITHDRAWAL FLOW

```
Admin Requests Withdrawal
    ↓
Withdrawal Request Created
    ↓
Signatories Assigned
    ↓
Chairperson Reviews & Approves
    ↓
Secretary Reviews & Approves
    ↓
Treasurer Reviews & Approves
    ↓
All Approved → Withdrawal Completed
    ↓
Receipt PDF Generated
    ↓
Signatories Receive Receipt
```

---

## IMPORTANT NOTES

### Phone Number Format
- Accepts: `0712345678`, `+254712345678`, `254712345678`
- Converts to: `254712345678` (M-Pesa format)

### Penalty Selection
- All penalties auto-selected by default
- Members can deselect individual penalties
- Total amount updates in real-time

### Withdrawal Approval
- Requires approval from ALL three signatories
- Any rejection cancels the withdrawal
- Rejection reason required
- Receipt includes all signatures

### Payment Verification
- Real-time polling (10-second intervals)
- Timeout after 5 minutes
- Manual verification available in admin panel

---

## TROUBLESHOOTING

### Payment Not Initiating
- Check phone number format
- Verify M-Pesa account active
- Check Supabase Edge Function logs
- Ensure STK Push credentials configured

### Withdrawal Stuck
- Check signatory role assignments
- Verify user has correct role
- Check RLS policies
- Review database logs

### Receipt Not Generated
- Check storage bucket permissions
- Verify Edge Function deployed
- Check withdrawal status is "completed"
- Review function logs

---

## TESTING CHECKLIST

- [ ] Member can view penalties
- [ ] Member can select/deselect penalties
- [ ] Total amount calculates correctly
- [ ] Phone number formats correctly
- [ ] STK Push initiates
- [ ] Payment verifies
- [ ] Wallet balance updates
- [ ] Admin can request withdrawal
- [ ] Signatories can approve
- [ ] Withdrawal completes
- [ ] Receipt generates
- [ ] All signatories receive receipt

---

## NEXT STEPS

1. ✅ Apply database migration
2. ✅ Create storage bucket
3. ✅ Copy component files
4. ✅ Update app routes
5. ✅ Update navigation
6. ✅ Test the system
7. ✅ Deploy to production

---

## SUPPORT

For detailed information, see: `PENALTY_WALLET_IMPLEMENTATION_GUIDE.md`

For issues:
1. Check Supabase logs
2. Review RLS policies
3. Check Edge Function logs
4. Verify database triggers
5. Review payment callbacks
