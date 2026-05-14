# Signatory Signature System - Complete Guide

## 📋 Overview

The signatory signature system allows chairperson, secretary, and treasurer to upload their digital signatures. When they approve a withdrawal, their signature is automatically prefilled on the withdrawal receipt along with their name.

---

## 🎯 Key Features

### 1. **Signature Upload**
- Each signatory uploads their digital signature image
- Signature stored in Supabase storage
- Signature URL saved in database
- Full name stored for receipt display

### 2. **Signature Prefilling**
- When signatory approves withdrawal, signature is automatically added to receipt
- Receipt shows:
  - Signatory's name
  - Signatory's signature image
  - Approval timestamp
  - Signatory role (Chairperson, Secretary, Treasurer)

### 3. **Receipt Generation**
- Receipt PDF includes all three signatures
- Each signature prefilled with signatory's name
- Receipt generated after all 3 signatories approve
- Receipt sent to all signatories

---

## 🗄️ Database Schema

### signatory_signatures Table
```sql
CREATE TABLE signatory_signatures (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  signatory_role TEXT (chairperson, secretary, treasurer),
  signature_url TEXT,
  full_name TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  UNIQUE(user_id, signatory_role)
);
```

**Fields**:
- `user_id` - Reference to auth.users
- `signatory_role` - chairperson, secretary, or treasurer
- `signature_url` - URL to signature image in storage
- `full_name` - Name to display on receipt
- `updated_at` - Last update timestamp

### withdrawal_signatories Table (Enhanced)
```sql
-- Already has these fields:
- signature_url (stores signature when approved)
- approved_at (timestamp of approval)
- rejection_reason (if rejected)
```

---

## 🚀 Implementation Steps

### Step 1: Run Migration
```bash
supabase migration up 20260512_signatory_signatures.sql
```

This creates:
- `signatory_signatures` table
- RLS policies for access control
- Indexes for performance

### Step 2: Add Signature Upload Page to Navigation

Update `src/App.tsx`:
```tsx
// Add route for signatory signature upload
{
  path: '/admin/signatory-signature',
  element: <SignatorySignatureUpload />,
}
```

Update `src/components/layout/AdminLayout.tsx`:
```tsx
// Add menu item
{
  icon: <Upload className="h-5 w-5" />,
  label: 'Upload Signature',
  href: '/admin/signatory-signature',
  roles: ['chairperson', 'secretary', 'treasurer'],
}
```

### Step 3: Signatories Upload Signatures

1. Chairperson logs in
2. Goes to "Upload Signature" page
3. Uploads signature image
4. Enters full name
5. Signature saved to database

Same for Secretary and Treasurer.

### Step 4: Signatories Approve Withdrawals

1. Withdrawal request submitted
2. Signatories assigned
3. Chairperson approves
   - Signature automatically fetched from `signatory_signatures`
   - Displayed on withdrawal card
4. Secretary approves
   - Signature displayed
5. Treasurer approves
   - Signature displayed
   - All 3 approved → B2C transfer initiated
   - Receipt generated with all 3 signatures

---

## 📄 Receipt Generation with Signatures

### Receipt Structure
```
┌─────────────────────────────────────┐
│   WITHDRAWAL RECEIPT                │
│   Date: [timestamp]                 │
├─────────────────────────────────────┤
│ Amount: KES [amount]                │
│ Reason: [reason]                    │
│ Phone: [phone_number]               │
├─────────────────────────────────────┤
│ APPROVALS:                          │
│                                     │
│ Chairperson: [name]                 │
│ [signature image]                   │
│ Approved: [timestamp]               │
│                                     │
│ Secretary: [name]                   │
│ [signature image]                   │
│ Approved: [timestamp]               │
│                                     │
│ Treasurer: [name]                   │
│ [signature image]                   │
│ Approved: [timestamp]               │
├─────────────────────────────────────┤
│ B2C Transfer: [transaction_id]      │
│ Status: Completed                   │
└─────────────────────────────────────┘
```

### Receipt Generation Code
```tsx
// In supabase/functions/generate-withdrawal-receipt/index.ts

const generateReceipt = async (withdrawal, signatories) => {
  // Fetch all signatory signatures
  const signatures = await fetchSignatories(signatories);
  
  // Create PDF with signatures
  const pdf = new jsPDF();
  
  // Add header
  pdf.text('WITHDRAWAL RECEIPT', 10, 10);
  
  // Add withdrawal details
  pdf.text(`Amount: KES ${withdrawal.amount}`, 10, 20);
  pdf.text(`Reason: ${withdrawal.reason}`, 10, 30);
  
  // Add signatures
  let yPosition = 50;
  for (const sig of signatures) {
    pdf.text(`${sig.signatory_role}: ${sig.full_name}`, 10, yPosition);
    pdf.addImage(sig.signature_url, 'PNG', 10, yPosition + 5, 30, 15);
    yPosition += 30;
  }
  
  // Save and return URL
  return pdf.output('datauristring');
};
```

---

## 🔐 Security & Access Control

### RLS Policies

**Signatories can view own signature**:
```sql
CREATE POLICY "Signatories can view own signature"
ON signatory_signatures FOR SELECT
USING (user_id = auth.uid());
```

**Signatories can update own signature**:
```sql
CREATE POLICY "Signatories can update own signature"
ON signatory_signatures FOR UPDATE
USING (user_id = auth.uid());
```

**Admin can view all signatures**:
```sql
CREATE POLICY "Admin can view all signatures"
ON signatory_signatures FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);
```

---

## 📱 UI Components

### SignatorySignatureUpload Component
**Location**: `src/pages/admin/SignatorySignatureUpload.tsx`

**Features**:
- Upload signature image
- Enter full name
- Preview signature
- Delete signature
- Shows current signature status

**Usage**:
```tsx
import SignatorySignatureUpload from '@/pages/admin/SignatorySignatureUpload';

// In App.tsx
{
  path: '/admin/signatory-signature',
  element: <SignatorySignatureUpload />,
}
```

### WithdrawalApproval Component (Enhanced)
**Location**: `src/pages/admin/WithdrawalApproval.tsx`

**Enhancements**:
- Fetches signatory signatures
- Displays signature preview when approved
- Shows signatory name with signature
- Prefills signature on receipt

---

## 🔄 Workflow

### 1. Signature Upload
```
Chairperson
  ↓
Goes to "Upload Signature"
  ↓
Uploads image
  ↓
Enters full name
  ↓
Signature saved to signatory_signatures table
  ↓
Signature URL stored in Supabase storage
```

### 2. Withdrawal Approval
```
Admin requests withdrawal
  ↓
Withdrawal submitted
  ↓
Signatories assigned
  ↓
Chairperson approves
  ├─ Signature fetched from signatory_signatures
  ├─ Displayed on withdrawal card
  └─ Stored in withdrawal_signatories.signature_url
  ↓
Secretary approves
  ├─ Signature fetched and displayed
  └─ Stored in withdrawal_signatories.signature_url
  ↓
Treasurer approves
  ├─ Signature fetched and displayed
  ├─ Stored in withdrawal_signatories.signature_url
  └─ All 3 approved
  ↓
B2C Transfer Initiated
  ↓
Receipt Generated
  ├─ All 3 signatures prefilled
  ├─ All 3 names displayed
  └─ Receipt sent to all signatories
```

---

## 📊 Data Flow

### Signature Upload Flow
```
User uploads image
  ↓
File validated (type, size)
  ↓
Uploaded to Supabase storage
  ↓
Public URL generated
  ↓
Saved to signatory_signatures table
  ├─ user_id
  ├─ signatory_role
  ├─ signature_url
  ├─ full_name
  └─ updated_at
  ↓
Confirmation shown to user
```

### Approval with Signature Flow
```
Signatory approves withdrawal
  ↓
Fetch signatory_signatures for this user
  ↓
Get signature_url and full_name
  ↓
Update withdrawal_signatories
  ├─ status = 'approved'
  ├─ signature_url = [from signatory_signatures]
  ├─ approved_at = now()
  └─ full_name = [from signatory_signatures]
  ↓
Check if all 3 approved
  ↓
If yes:
  ├─ Fetch all signatures
  ├─ Generate receipt PDF
  ├─ Upload receipt to storage
  ├─ Initiate B2C transfer
  └─ Send receipt to all signatories
```

---

## 🧪 Testing

### Test 1: Upload Signature
1. Log in as chairperson
2. Go to "Upload Signature"
3. Upload signature image
4. Enter full name
5. Verify signature saved
6. Verify signature displayed

### Test 2: View Signature on Withdrawal
1. Create withdrawal request
2. Submit for approval
3. Chairperson approves
4. Verify signature displayed on withdrawal card
5. Verify name displayed with signature

### Test 3: Receipt with Signatures
1. All 3 signatories approve
2. B2C transfer initiated
3. Receipt generated
4. Verify receipt contains all 3 signatures
5. Verify receipt contains all 3 names
6. Verify receipt sent to all signatories

### Test 4: Update Signature
1. Upload new signature
2. Verify old signature replaced
3. Verify new signature used on next approval

### Test 5: Delete Signature
1. Delete signature
2. Verify signature_url set to NULL
3. Verify cannot approve without signature

---

## 📋 Checklist

- [ ] Run migration: `20260512_signatory_signatures.sql`
- [ ] Create `SignatorySignatureUpload` component
- [ ] Add route to `App.tsx`
- [ ] Add menu item to `AdminLayout.tsx`
- [ ] Update `WithdrawalApproval` to fetch signatures
- [ ] Update receipt generation to include signatures
- [ ] Test signature upload
- [ ] Test signature display on withdrawal
- [ ] Test receipt generation with signatures
- [ ] Test signature update
- [ ] Test signature deletion
- [ ] Deploy to production

---

## 🔧 Configuration

### Storage Bucket
Signatures stored in: `signatures/signatory-signatures/`

### File Naming
Format: `{signatory_role}-signature-{user_id}-{timestamp}.{ext}`

Example: `chairperson-signature-550e8400-e29b-41d4-a716-446655440000-1715000000000.png`

### File Size Limit
Max 2MB per signature

### Supported Formats
- PNG
- JPG
- JPEG

---

## 📞 Support

### Files
- `supabase/migrations/20260512_signatory_signatures.sql` - Database schema
- `src/pages/admin/SignatorySignatureUpload.tsx` - Upload component
- `src/pages/admin/WithdrawalApproval.tsx` - Approval component (enhanced)
- `supabase/functions/generate-withdrawal-receipt/index.ts` - Receipt generation

### Documentation
- `WITHDRAWAL_APPROVAL_GUIDE.md` - Approval workflow
- `WITHDRAWAL_APPROVAL_SETUP_GUIDE.md` - Setup instructions
- `SIGNATORY_SIGNATURE_SYSTEM.md` - This file

---

## 🎯 Next Steps

1. **Run Migration**
   ```bash
   supabase migration up 20260512_signatory_signatures.sql
   ```

2. **Add Routes**
   - Update `App.tsx` with new route
   - Update `AdminLayout.tsx` with menu item

3. **Test Signature Upload**
   - Log in as chairperson
   - Upload signature
   - Verify saved

4. **Test Approval with Signature**
   - Create withdrawal
   - Approve as chairperson
   - Verify signature displayed

5. **Test Receipt Generation**
   - All 3 signatories approve
   - Verify receipt includes all signatures
   - Verify receipt sent to all

---

**Version**: 1.0.0
**Date**: May 12, 2026
**Status**: Ready for Implementation
