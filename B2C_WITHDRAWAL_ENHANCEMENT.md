# B2C Withdrawal Enhancement - Implementation Guide

## 🎯 Overview

The penalty wallet system has been enhanced with M-Pesa B2C (Business to Customer) integration. When all three signatories approve a withdrawal request, the system automatically transfers funds from the penalty wallet to the specified M-Pesa phone number.

---

## ✨ What's New

### 1. Enhanced Withdrawal Form
- **Phone Number Field**: Admin specifies the M-Pesa phone number for fund transfer
- **Better UI**: Improved form with icons, validation, and helpful hints
- **Validation**: Phone number format validation (0712345678 or +254712345678)
- **Information Box**: Clear explanation of the approval and transfer process

### 2. Automatic B2C Transfer
- **Triggered on Final Approval**: When the last signatory approves, B2C transfer is initiated
- **Real-time Status**: System shows transfer status in real-time
- **Error Handling**: If transfer fails, withdrawal remains in "approved" state for retry
- **Transaction Tracking**: All B2C transactions are logged and tracked

### 3. Enhanced Approval Page
- **Phone Number Display**: Shows the M-Pesa number where funds will be transferred
- **Transfer Status**: Clear indication of transfer progress
- **Automatic Completion**: Withdrawal automatically marked as "completed" after successful transfer

---

## 🔄 Workflow

### Step 1: Admin Requests Withdrawal
```
Admin → Penalty Wallet Page
  ↓
Click "Request Withdrawal"
  ↓
Enter:
  - Amount (KES)
  - M-Pesa Phone Number (0712345678)
  - Reason (Office supplies, etc.)
  ↓
Submit for Approval
  ↓
Withdrawal created with status "pending"
Three signatory records created
```

### Step 2: Signatories Approve
```
Chairperson → Withdrawal Approvals
  ↓
Review withdrawal details
  ↓
Click "Approve"
  ↓
Status: Chairperson ✅

Secretary → Withdrawal Approvals
  ↓
Review withdrawal details
  ↓
Click "Approve"
  ↓
Status: Secretary ✅

Treasurer → Withdrawal Approvals
  ↓
Review withdrawal details
  ↓
Click "Approve"
  ↓
Status: Treasurer ✅
```

### Step 3: Automatic B2C Transfer
```
All three approved?
  ↓
YES → Initiate B2C Transfer
  ↓
Transfer KES [amount] to [phone_number]
  ↓
Transfer Successful?
  ↓
YES → Withdrawal status = "completed"
      Funds transferred to phone
      Receipt generated
      All signatories notified
  ↓
NO → Withdrawal status = "approved"
     Error logged
     Admin can retry transfer
```

---

## 📁 Files Created/Modified

### New Files
1. **src/lib/b2c.ts** - M-Pesa B2C service
   - `formatPhoneForB2C()` - Format phone numbers
   - `validatePhoneNumber()` - Validate phone format
   - `initiateB2CWithdrawal()` - Initiate B2C transfer
   - `checkB2CStatus()` - Check transfer status
   - `pollB2CStatus()` - Poll until completion
   - `getB2CTransactionHistory()` - Get transaction history

2. **supabase/migrations/20260512_add_b2c_withdrawal.sql** - Database schema
   - Add `phone_number` column to `penalty_withdrawals`
   - Create `b2c_transactions` table
   - Create RLS policies
   - Create indexes for performance

### Modified Files
1. **src/pages/admin/PenaltyWallet.tsx**
   - Added phone number input field
   - Enhanced withdrawal form UI
   - Added phone number validation
   - Updated withdrawal display to show phone number

2. **src/pages/admin/WithdrawalApproval.tsx**
   - Added B2C transfer initiation on final approval
   - Display phone number in withdrawal details
   - Show transfer status
   - Handle B2C errors gracefully

---

## 🔐 Security Features

### Phone Number Validation
- Format validation: `254XXXXXXXXX` (12 digits)
- Supports multiple formats: `0712345678`, `+254712345678`, `254712345678`
- Automatic formatting to M-Pesa standard format

### B2C Transaction Security
- All transactions logged in database
- Transaction ID tracking for audit trail
- Status tracking (initiated, pending, completed, failed)
- Error messages logged for debugging

### RLS Policies
- Only admin/super_admin can view B2C transactions
- Only admin/super_admin can create B2C transactions
- Only admin/super_admin can update B2C transactions

---

## 📊 Database Schema

### penalty_withdrawals (Enhanced)
```sql
ALTER TABLE penalty_withdrawals
ADD COLUMN phone_number TEXT;
```

### b2c_transactions (New)
```sql
CREATE TABLE b2c_transactions (
  id UUID PRIMARY KEY,
  withdrawal_id UUID REFERENCES penalty_withdrawals(id),
  mpesa_transaction_id TEXT UNIQUE,
  phone_number TEXT,
  amount NUMERIC,
  status TEXT ('initiated', 'pending', 'completed', 'failed'),
  initiated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

## 🔌 API Integration

### Backend Endpoint Required
The system expects a backend API endpoint at `/api/b2c/withdraw`:

```typescript
POST /api/b2c/withdraw
{
  withdrawalId: string;
  amount: number;
  phoneNumber: string;  // Format: 254XXXXXXXXX
  reason: string;
  adminName: string;
}

Response:
{
  success: boolean;
  transactionId?: string;
  message?: string;
  error?: string;
}
```

### Status Check Endpoint
```typescript
GET /api/b2c/status/:transactionId

Response:
{
  status: 'completed' | 'pending' | 'failed';
  transactionId: string;
  message: string;
}
```

---

## 🧪 Testing Scenarios

### Scenario 1: Successful Withdrawal
```
1. Admin requests withdrawal with valid phone number
2. Chairperson approves
3. Secretary approves
4. Treasurer approves
5. B2C transfer initiated
6. Transfer successful
7. Withdrawal marked as "completed"
8. Funds appear in phone account
```

### Scenario 2: Transfer Failure
```
1. Admin requests withdrawal
2. All three signatories approve
3. B2C transfer initiated
4. Transfer fails (network error, invalid account, etc.)
5. Withdrawal marked as "approved" (not completed)
6. Error message logged
7. Admin can retry transfer
```

### Scenario 3: Invalid Phone Number
```
1. Admin requests withdrawal with invalid phone number
2. Form validation fails
3. Error message: "Invalid phone number format"
4. Admin corrects phone number
5. Resubmit withdrawal
```

### Scenario 4: Insufficient Balance
```
1. Admin requests withdrawal for amount > wallet balance
2. Form validation fails
3. Error message: "Invalid amount or insufficient balance"
4. Admin reduces amount
5. Resubmit withdrawal
```

---

## 📱 User Interface

### Withdrawal Request Form
```
┌─────────────────────────────────────┐
│ Request Penalty Wallet Withdrawal   │
├─────────────────────────────────────┤
│                                     │
│ Available Balance: KES 50,000       │
│                                     │
│ Withdrawal Amount                   │
│ [$ ________________]                │
│ Minimum: KES 100                    │
│                                     │
│ M-Pesa Phone Number                 │
│ [☎ 0712345678]                      │
│ Format: 0712345678 or +254712345678 │
│                                     │
│ Reason for Withdrawal               │
│ [📄 Office supplies...]             │
│ Be specific about the purpose       │
│                                     │
│ ⚠️ Important                        │
│ • Requires approval from 3 signatories
│ • Funds transferred to M-Pesa number
│ • Transfer happens automatically    │
│ • Receipt generated with signatures │
│                                     │
│ [Submit for Approval]               │
└─────────────────────────────────────┘
```

### Withdrawal Display
```
┌─────────────────────────────────────┐
│ KES 10,000                [Pending] │
│ Office supplies                     │
│                                     │
│ ☎ Transfer to: 0712345678          │
│                                     │
│ Approvals Required:                 │
│ ✅ Chairperson: Approved           │
│ ⏳ Secretary: Pending              │
│ ⏳ Treasurer: Pending              │
│                                     │
│ Requested: 2026-05-12 14:30:00     │
└─────────────────────────────────────┘
```

---

## 🚀 Deployment Steps

### 1. Database Migration
```bash
# Run the B2C migration
supabase migration up 20260512_add_b2c_withdrawal.sql
```

### 2. Backend API Setup
Create endpoints:
- `POST /api/b2c/withdraw` - Initiate B2C transfer
- `GET /api/b2c/status/:transactionId` - Check status

### 3. M-Pesa Configuration
- Configure M-Pesa B2C credentials
- Set up callback URLs for transaction status
- Test with sandbox environment first

### 4. Deploy Frontend
```bash
npm run build
# Deploy dist folder
```

### 5. Testing
- Test with staging M-Pesa account
- Verify all withdrawal scenarios
- Check error handling
- Verify transaction logging

---

## 🔧 Configuration

### Environment Variables
```env
# M-Pesa B2C Configuration
VITE_MPESA_B2C_CONSUMER_KEY=your_key
VITE_MPESA_B2C_CONSUMER_SECRET=your_secret
VITE_MPESA_B2C_SHORTCODE=your_shortcode
VITE_MPESA_B2C_PASSKEY=your_passkey
VITE_MPESA_B2C_INITIATOR_NAME=your_initiator
VITE_MPESA_B2C_SECURITY_CREDENTIAL=your_credential
```

### API Configuration
```typescript
// src/lib/b2c.ts
const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3000';
const B2C_ENDPOINT = `${API_BASE_URL}/api/b2c`;
```

---

## 📊 Monitoring & Logging

### Transaction Logging
All B2C transactions are logged in the `b2c_transactions` table:
- Transaction ID
- Phone number
- Amount
- Status (initiated, pending, completed, failed)
- Timestamps
- Error messages

### Error Tracking
- Network errors logged
- Invalid phone numbers logged
- Transfer failures logged
- Retry attempts tracked

### Audit Trail
- All withdrawals tracked
- All approvals tracked
- All transfers tracked
- Complete history available

---

## 🐛 Troubleshooting

### Problem: "Invalid phone number format"
**Solution**: Use format `0712345678` or `+254712345678`

### Problem: "Transfer failed"
**Solution**: 
- Check M-Pesa account balance
- Verify phone number is active
- Check M-Pesa credentials
- Retry transfer

### Problem: "Insufficient balance"
**Solution**: 
- Check wallet balance
- Reduce withdrawal amount
- Wait for more penalty payments

### Problem: "Transfer stuck on pending"
**Solution**:
- Check transaction status in database
- Verify M-Pesa callback received
- Check error logs
- Contact M-Pesa support if needed

---

## 📞 Support

### For Users
- See `PENALTY_WALLET_ACCESS_GUIDE.md` for user guide
- Check troubleshooting section above

### For Developers
- See `PENALTY_WALLET_IMPLEMENTATION_GUIDE.md` for technical details
- Check `src/lib/b2c.ts` for implementation

### For DevOps
- See `PENALTY_WALLET_DEPLOYMENT_CHECKLIST.md` for deployment
- Check database migrations

---

## 🎉 Summary

The B2C withdrawal enhancement provides:
- ✅ Automatic fund transfers to M-Pesa
- ✅ Multi-signatory approval workflow
- ✅ Real-time transfer status
- ✅ Complete transaction tracking
- ✅ Error handling and retry logic
- ✅ Secure phone number validation
- ✅ Comprehensive audit trail

---

**Version**: 1.0.0
**Date**: May 12, 2026
**Status**: Ready for Deployment
