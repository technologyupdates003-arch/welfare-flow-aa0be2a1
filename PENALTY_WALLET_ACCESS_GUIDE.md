# Penalty Wallet System - Access Guide

## Quick Access URLs

### For Members
- **Pay Penalties**: `https://yourapp.com/member/pay-penalty`
- **Member Dashboard**: `https://yourapp.com/member`

### For Admin
- **Penalty Wallet**: `https://yourapp.com/admin/penalty-wallet`
- **Withdrawal Approvals**: `https://yourapp.com/admin/withdrawal-approval`
- **Admin Dashboard**: `https://yourapp.com/admin`

---

## Member: How to Pay Penalties

### Step 1: Navigate to Pay Penalty Page
1. Login to your member account
2. Click "Pay Penalty" in the sidebar menu
3. Or go directly to: `/member/pay-penalty`

### Step 2: Review Your Penalties
- All unpaid penalties are automatically loaded
- Penalties are pre-selected by default
- Total amount to pay is displayed

### Step 3: Enter Phone Number
1. Enter your M-Pesa phone number (format: 0712345678 or +254712345678)
2. Verify the number is correct

### Step 4: Initiate Payment
1. Click "Pay KES [amount]" button
2. You will receive an M-Pesa prompt on your phone
3. Enter your M-Pesa PIN to complete payment

### Step 5: Verification
- Payment is verified in real-time
- You'll see a success message
- Your penalties will be marked as paid
- Receipt will be sent to your email

---

## Admin: How to Manage Penalty Wallet

### Step 1: View Wallet Balance
1. Login to your admin account
2. Click "Penalty Wallet" in the sidebar menu
3. Or go directly to: `/admin/penalty-wallet`

### Step 2: Check Wallet Status
- **Total Balance**: All penalty money currently in wallet
- **Total Received**: All penalty payments received to date
- **Total Withdrawn**: All amounts withdrawn to date

### Step 3: View Recent Payments
- Scroll down to see recent penalty payments
- See member name, amount, status, and date
- Filter by status (pending, verified, failed)

### Step 4: Request Withdrawal
1. Click "Request Withdrawal" button
2. Enter the amount you want to withdraw
3. Enter the reason for withdrawal (e.g., "Office supplies", "Maintenance")
4. Click "Submit for Approval"
5. Withdrawal request is now pending signatory approval

### Step 5: Track Withdrawal Status
- View all withdrawal requests in the list
- See approval status from each signatory:
  - ✅ Approved (green)
  - ❌ Rejected (red)
  - ⏳ Pending (yellow)
- Once all three approve, withdrawal is completed

---

## Signatories: How to Approve Withdrawals

### Who Can Approve?
- **Chairperson**
- **Secretary**
- **Treasurer**

All three must approve before withdrawal is completed.

### Step 1: Navigate to Withdrawal Approvals
1. Login to your account (must have signatory role)
2. Click "Withdrawal Approvals" in the sidebar menu
3. Or go directly to: `/admin/withdrawal-approval`

### Step 2: View Pending Approvals
- See all withdrawals pending your approval
- Shows amount, reason, and requested date
- Shows approval status from other signatories

### Step 3: Review Withdrawal Details
- **Amount**: How much is being withdrawn
- **Reason**: Why the withdrawal is needed
- **Requested**: When the withdrawal was requested
- **Signatories**: Status from chairperson, secretary, treasurer

### Step 4: Approve Withdrawal
1. Click "Approve" button
2. Confirm you approve the withdrawal
3. Your approval is recorded
4. If all three have approved, withdrawal is completed

### Step 5: Reject Withdrawal (if needed)
1. Click "Reject" button
2. Enter reason for rejection (required)
3. Click "Reject" to confirm
4. Withdrawal status changes to "rejected"
5. Admin is notified of rejection

### Step 6: Receive Receipt
- After all three approve, receipt PDF is generated
- Receipt includes:
  - Withdrawal amount
  - Reason for withdrawal
  - Date of withdrawal
  - Signatures from all three signatories
- Receipt is sent to all signatories via email

---

## Navigation Menu Items

### Member Sidebar
```
Home
Events
Documents
Beneficiaries
Downloads
Pay Penalty ← NEW
Alerts
Profile
```

### Admin Sidebar
```
Dashboard
Members
Contributions
Excel Import
Beneficiary Import
Beneficiary Dashboard
Payments
Unmatched
Verify Penalties
Penalty Wallet ← NEW
Withdrawal Approvals ← NEW
Bulk SMS
Events
Documents
News
Meeting Minutes
Defaulters
Beneficiary Requests
Notifications
Office Signatures
Settings
```

---

## Common Tasks

### Task: Check if a Member Paid Their Penalty
1. Go to `/admin/penalty-wallet`
2. Scroll to "Recent Penalty Payments"
3. Look for member name and status
4. Status "verified" = payment confirmed

### Task: Withdraw Money from Penalty Wallet
1. Go to `/admin/penalty-wallet`
2. Click "Request Withdrawal"
3. Enter amount and reason
4. Submit for approval
5. Wait for all three signatories to approve
6. Withdrawal is completed automatically

### Task: Approve a Withdrawal as Chairperson
1. Go to `/admin/withdrawal-approval`
2. Find the withdrawal in the list
3. Review amount and reason
4. Click "Approve"
5. Confirm approval
6. Wait for secretary and treasurer to approve

### Task: Reject a Withdrawal with Reason
1. Go to `/admin/withdrawal-approval`
2. Find the withdrawal in the list
3. Click "Reject"
4. Enter reason (e.g., "Insufficient documentation")
5. Click "Reject" to confirm
6. Withdrawal status changes to "rejected"

### Task: View Withdrawal History
1. Go to `/admin/penalty-wallet`
2. Scroll to "Withdrawal Requests"
3. See all past and current withdrawals
4. See status of each withdrawal

---

## Troubleshooting

### Problem: "You do not have a valid signatory role"
**Solution**: You need to be assigned as chairperson, secretary, or treasurer to approve withdrawals. Contact admin to assign your role.

### Problem: M-Pesa payment prompt not appearing
**Solution**: 
- Check phone number format (should be 0712345678)
- Ensure M-Pesa is active on your phone
- Try again in a few seconds
- Contact support if problem persists

### Problem: Payment shows as "pending" instead of "verified"
**Solution**: 
- Payment verification can take up to 5 minutes
- Refresh the page
- Check your M-Pesa message for confirmation
- Contact admin if still pending after 10 minutes

### Problem: Cannot submit withdrawal request
**Solution**:
- Ensure amount is less than wallet balance
- Ensure you entered a reason
- Ensure amount is greater than 0
- Try again or contact admin

### Problem: Withdrawal stuck on "pending"
**Solution**:
- Check if all three signatories have approved
- Contact the signatories to approve
- If rejected, admin needs to submit new request

---

## Important Notes

⚠️ **Security**
- Never share your M-Pesa PIN
- Only approve withdrawals you have verified
- Report suspicious activity immediately

⚠️ **Accuracy**
- Double-check withdrawal amount before submitting
- Verify member phone number before payment
- Confirm reason for withdrawal is accurate

⚠️ **Timing**
- Payment verification takes up to 5 minutes
- Withdrawal approval requires all three signatories
- Receipt generation is automatic after approval

---

## Support

For issues or questions:
1. Check this guide first
2. Contact your admin
3. Check system logs for errors
4. Contact technical support if needed

---

**Last Updated**: May 12, 2026
**System**: Welfare Flow - Penalty Wallet
