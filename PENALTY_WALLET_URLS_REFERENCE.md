# Penalty Wallet System - URLs & Access Reference

## 🔗 Direct URLs

### Member Features
```
Pay Penalties:
  http://localhost:5173/member/pay-penalty
  https://yourapp.com/member/pay-penalty

Member Dashboard:
  http://localhost:5173/member
  https://yourapp.com/member
```

### Admin Features
```
Penalty Wallet:
  http://localhost:5173/admin/penalty-wallet
  https://yourapp.com/admin/penalty-wallet

Withdrawal Approvals:
  http://localhost:5173/admin/withdrawal-approval
  https://yourapp.com/admin/withdrawal-approval

Admin Dashboard:
  http://localhost:5173/admin
  https://yourapp.com/admin
```

---

## 🧭 Navigation Paths

### From Member Dashboard
1. Click "Pay Penalty" in sidebar
2. Or click "Alerts" menu → "Pay Penalty"

### From Admin Dashboard
1. Click "Penalty Wallet" in sidebar
2. Or click "Withdrawal Approvals" in sidebar

### From Signatory Dashboard
1. Click "Withdrawal Approvals" in sidebar
2. (Only visible if you have chairperson, secretary, or treasurer role)

---

## 📱 Mobile Access

### Member Mobile
```
URL: /member/pay-penalty
Bottom Navigation: Tap "Pay Penalty" (4th icon)
Or: Tap menu → "Pay Penalty"
```

### Admin Mobile
```
URL: /admin/penalty-wallet
Sidebar: Tap menu icon → "Penalty Wallet"
Or: /admin/withdrawal-approval
Sidebar: Tap menu icon → "Withdrawal Approvals"
```

---

## 🔐 Role-Based Access

### Member Role
- ✅ Can access: `/member/pay-penalty`
- ❌ Cannot access: `/admin/penalty-wallet`, `/admin/withdrawal-approval`

### Admin Role
- ✅ Can access: `/admin/penalty-wallet`, `/admin/withdrawal-approval`
- ✅ Can access: `/member/pay-penalty` (as member)
- ✅ Can access: `/admin/*` (all admin pages)

### Chairperson Role
- ✅ Can access: `/admin/withdrawal-approval` (as signatory)
- ✅ Can access: `/member/pay-penalty` (as member)
- ❌ Cannot access: `/admin/penalty-wallet` (unless also admin)

### Secretary Role
- ✅ Can access: `/admin/withdrawal-approval` (as signatory)
- ✅ Can access: `/member/pay-penalty` (as member)
- ❌ Cannot access: `/admin/penalty-wallet` (unless also admin)

### Treasurer Role
- ✅ Can access: `/admin/withdrawal-approval` (as signatory)
- ✅ Can access: `/member/pay-penalty` (as member)
- ❌ Cannot access: `/admin/penalty-wallet` (unless also admin)

### Super Admin Role
- ✅ Can access: All routes
- ✅ Can access: `/super-admin/*`
- ✅ Can access: `/admin/*`
- ✅ Can access: `/member/*`

---

## 🔄 Complete User Journeys

### Journey 1: Member Pays Penalty
```
1. Login as member
2. Navigate to: /member/pay-penalty
3. View penalties (auto-loaded)
4. Review total amount (auto-calculated)
5. Enter M-Pesa phone number
6. Click "Pay KES [amount]"
7. Receive M-Pesa prompt
8. Enter M-Pesa PIN
9. Payment verified
10. See success message
11. Penalty marked as paid
```

### Journey 2: Admin Requests Withdrawal
```
1. Login as admin
2. Navigate to: /admin/penalty-wallet
3. View wallet balance
4. Click "Request Withdrawal"
5. Enter amount
6. Enter reason
7. Click "Submit for Approval"
8. Withdrawal created with status "pending"
9. Three signatory records created
10. Signatories notified (optional)
```

### Journey 3: Chairperson Approves Withdrawal
```
1. Login as chairperson
2. Navigate to: /admin/withdrawal-approval
3. See pending withdrawal
4. Review amount and reason
5. Click "Approve"
6. Confirm approval
7. Approval recorded
8. Wait for secretary and treasurer
```

### Journey 4: Secretary Approves Withdrawal
```
1. Login as secretary
2. Navigate to: /admin/withdrawal-approval
3. See pending withdrawal
4. See chairperson approved ✅
5. Click "Approve"
6. Confirm approval
7. Approval recorded
8. Wait for treasurer
```

### Journey 5: Treasurer Approves Withdrawal
```
1. Login as treasurer
2. Navigate to: /admin/withdrawal-approval
3. See pending withdrawal
4. See chairperson approved ✅
5. See secretary approved ✅
6. Click "Approve"
7. Confirm approval
8. All three approved!
9. Withdrawal status changes to "approved"
10. Receipt generated
11. Receipt sent to all signatories
```

---

## 🎯 Quick Links by Role

### Member
| Task | URL |
|------|-----|
| Pay Penalty | `/member/pay-penalty` |
| View Dashboard | `/member` |
| View Events | `/member/events` |
| View Documents | `/member/documents` |
| View Beneficiaries | `/member/beneficiaries` |
| View Profile | `/member/profile` |

### Admin
| Task | URL |
|------|-----|
| Penalty Wallet | `/admin/penalty-wallet` |
| Withdrawal Approvals | `/admin/withdrawal-approval` |
| Admin Dashboard | `/admin` |
| Members | `/admin/members` |
| Contributions | `/admin/contributions` |
| Payments | `/admin/payments` |
| Verify Penalties | `/admin/penalty-payments` |

### Chairperson
| Task | URL |
|------|-----|
| Withdrawal Approvals | `/admin/withdrawal-approval` |
| Chairperson Dashboard | `/chairperson` |
| Approve Minutes | `/chairperson/approve-minutes` |
| Upload Signature | `/chairperson/signature` |
| Member Dashboard | `/member` |

### Secretary
| Task | URL |
|------|-----|
| Withdrawal Approvals | `/admin/withdrawal-approval` |
| Secretary Dashboard | `/secretary` |
| Meeting Minutes | `/secretary/minutes` |
| Upload Signature | `/secretary/signature` |
| Member Dashboard | `/member` |

### Treasurer
| Task | URL |
|------|-----|
| Withdrawal Approvals | `/admin/withdrawal-approval` |
| Treasurer Dashboard | `/treasurer` |
| Contributions | `/treasurer/contributions` |
| Expenses | `/treasurer/expenses` |
| Member Dashboard | `/member` |

---

## 🔍 API Endpoints (Backend)

### Supabase Tables
```
GET /penalty_wallet
  - Get wallet balance

GET /penalty_payment_records
  - Get payment records

GET /penalty_withdrawals
  - Get withdrawal requests

GET /withdrawal_signatories
  - Get signatory approvals

GET /withdrawal_receipts
  - Get receipt records
```

### Supabase Functions
```
POST /functions/v1/generate-withdrawal-receipt
  - Generate receipt PDF
```

### M-Pesa Integration
```
POST /api/stkpush
  - Initiate STK Push payment

GET /api/stkpush/status/:checkoutRequestId
  - Check payment status
```

---

## 📊 Data Flow Diagram

```
Member
  ↓
/member/pay-penalty
  ↓
Select Penalties → Enter Phone → STK Push
  ↓
M-Pesa Payment
  ↓
Payment Verified
  ↓
penalty_payment_records (created)
  ↓
penalty_wallet (updated via trigger)
  ↓
Admin
  ↓
/admin/penalty-wallet
  ↓
Request Withdrawal
  ↓
penalty_withdrawals (created)
withdrawal_signatories (3 records created)
  ↓
Chairperson
  ↓
/admin/withdrawal-approval
  ↓
Approve
  ↓
withdrawal_signatories (chairperson approved)
  ↓
Secretary
  ↓
/admin/withdrawal-approval
  ↓
Approve
  ↓
withdrawal_signatories (secretary approved)
  ↓
Treasurer
  ↓
/admin/withdrawal-approval
  ↓
Approve
  ↓
withdrawal_signatories (treasurer approved)
  ↓
All Approved?
  ↓
penalty_withdrawals (status = "approved")
penalty_wallet (updated via trigger)
withdrawal_receipts (generated)
  ↓
Receipt Sent to All Signatories
```

---

## 🧪 Testing URLs

### Test Member Payment
```
1. Go to: /member/pay-penalty
2. Should see: All unpaid penalties
3. Should see: Total amount pre-filled
4. Should see: Phone number field
5. Should see: "Pay KES [amount]" button
```

### Test Admin Wallet
```
1. Go to: /admin/penalty-wallet
2. Should see: Wallet balance cards
3. Should see: "Request Withdrawal" button
4. Should see: Withdrawal requests list
5. Should see: Recent payments table
```

### Test Signatory Approval
```
1. Go to: /admin/withdrawal-approval
2. Should see: Pending approvals count
3. Should see: Withdrawal cards
4. Should see: "Approve" and "Reject" buttons
5. Should see: Signatory status
```

---

## 🚀 Deployment URLs

### Development
```
Base URL: http://localhost:5173
Member: http://localhost:5173/member/pay-penalty
Admin: http://localhost:5173/admin/penalty-wallet
Signatory: http://localhost:5173/admin/withdrawal-approval
```

### Staging
```
Base URL: https://staging.yourapp.com
Member: https://staging.yourapp.com/member/pay-penalty
Admin: https://staging.yourapp.com/admin/penalty-wallet
Signatory: https://staging.yourapp.com/admin/withdrawal-approval
```

### Production
```
Base URL: https://yourapp.com
Member: https://yourapp.com/member/pay-penalty
Admin: https://yourapp.com/admin/penalty-wallet
Signatory: https://yourapp.com/admin/withdrawal-approval
```

---

## 📋 Bookmark These URLs

### For Members
- [ ] `/member/pay-penalty` - Pay penalties
- [ ] `/member` - Member dashboard

### For Admin
- [ ] `/admin/penalty-wallet` - Manage wallet
- [ ] `/admin/withdrawal-approval` - Approve withdrawals
- [ ] `/admin` - Admin dashboard

### For Signatories
- [ ] `/admin/withdrawal-approval` - Approve withdrawals

---

## 🔗 Related Documentation

- **Access Guide**: `PENALTY_WALLET_ACCESS_GUIDE.md`
- **Implementation Guide**: `PENALTY_WALLET_IMPLEMENTATION_GUIDE.md`
- **Quick Start**: `PENALTY_WALLET_QUICK_START.md`
- **Integration Complete**: `PENALTY_WALLET_INTEGRATION_COMPLETE.md`
- **Final Summary**: `PENALTY_WALLET_FINAL_SUMMARY.md`

---

**Last Updated**: May 12, 2026
**System**: Welfare Flow Application
**Version**: 1.0.0
