# Signatory Signature System - Integration Guide

## 🔗 How to Integrate into Your App

### Step 1: Add Route to App.tsx

Find your routes configuration and add:

```tsx
import SignatorySignatureUpload from '@/pages/admin/SignatorySignatureUpload';

// In your routes array, add this route:
{
  path: '/admin/signatory-signature',
  element: <SignatorySignatureUpload />,
  // Optional: add role-based access
  // roles: ['chairperson', 'secretary', 'treasurer']
}
```

**Example location in App.tsx**:
```tsx
const routes = [
  // ... other routes
  {
    path: '/admin/penalty-wallet',
    element: <PenaltyWallet />,
  },
  {
    path: '/admin/withdrawal-approval',
    element: <WithdrawalApproval />,
  },
  // ADD THIS NEW ROUTE:
  {
    path: '/admin/signatory-signature',
    element: <SignatorySignatureUpload />,
  },
  // ... more routes
];
```

---

### Step 2: Add Menu Item to AdminLayout.tsx

Find your menu items configuration and add:

```tsx
import { Upload } from 'lucide-react';

// In your menu items array, add:
{
  icon: <Upload className="h-5 w-5" />,
  label: 'Upload Signature',
  href: '/admin/signatory-signature',
  // Optional: restrict to specific roles
  // roles: ['chairperson', 'secretary', 'treasurer']
}
```

**Example location in AdminLayout.tsx**:
```tsx
const menuItems = [
  // ... other items
  {
    icon: <DollarSign className="h-5 w-5" />,
    label: 'Penalty Wallet',
    href: '/admin/penalty-wallet',
  },
  {
    icon: <FileSignature className="h-5 w-5" />,
    label: 'Withdrawal Approvals',
    href: '/admin/withdrawal-approval',
  },
  // ADD THIS NEW MENU ITEM:
  {
    icon: <Upload className="h-5 w-5" />,
    label: 'Upload Signature',
    href: '/admin/signatory-signature',
  },
  // ... more items
];
```

---

## 📋 Complete Integration Example

### App.tsx
```tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SignatorySignatureUpload from '@/pages/admin/SignatorySignatureUpload';
import PenaltyWallet from '@/pages/admin/PenaltyWallet';
import WithdrawalApproval from '@/pages/admin/WithdrawalApproval';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Admin Routes */}
        <Route path="/admin/penalty-wallet" element={<PenaltyWallet />} />
        <Route path="/admin/withdrawal-approval" element={<WithdrawalApproval />} />
        <Route path="/admin/signatory-signature" element={<SignatorySignatureUpload />} />
        
        {/* Other routes... */}
      </Routes>
    </Router>
  );
}
```

### AdminLayout.tsx
```tsx
import { Upload, DollarSign, FileSignature } from 'lucide-react';

export default function AdminLayout() {
  const menuItems = [
    {
      icon: <DollarSign className="h-5 w-5" />,
      label: 'Penalty Wallet',
      href: '/admin/penalty-wallet',
    },
    {
      icon: <FileSignature className="h-5 w-5" />,
      label: 'Withdrawal Approvals',
      href: '/admin/withdrawal-approval',
    },
    {
      icon: <Upload className="h-5 w-5" />,
      label: 'Upload Signature',
      href: '/admin/signatory-signature',
    },
  ];

  return (
    <div className="flex">
      <Sidebar items={menuItems} />
      <main className="flex-1">
        {/* Content */}
      </main>
    </div>
  );
}
```

---

## 🔄 User Flow

### For Chairperson
```
1. Log in as chairperson
2. See "Upload Signature" in menu
3. Click "Upload Signature"
4. Upload signature image
5. Enter full name
6. Signature saved
7. When approving withdrawals, signature automatically used
```

### For Secretary
```
1. Log in as secretary
2. See "Upload Signature" in menu
3. Click "Upload Signature"
4. Upload signature image
5. Enter full name
6. Signature saved
7. When approving withdrawals, signature automatically used
```

### For Treasurer
```
1. Log in as treasurer
2. See "Upload Signature" in menu
3. Click "Upload Signature"
4. Upload signature image
5. Enter full name
6. Signature saved
7. When approving withdrawals, signature automatically used
```

---

## 🧪 Testing After Integration

### Test 1: Route Works
1. Build project: `npm run build`
2. Log in as chairperson
3. Navigate to `/admin/signatory-signature`
4. Should see "Upload Signature" page

### Test 2: Menu Item Works
1. Log in as chairperson
2. Check admin menu
3. Should see "Upload Signature" item
4. Click it
5. Should navigate to signature upload page

### Test 3: Upload Works
1. Go to signature upload page
2. Upload signature image
3. Enter full name
4. Click upload
5. Should see success message
6. Signature should be saved

### Test 4: Signature on Withdrawal
1. Create withdrawal request
2. Submit for approval
3. Chairperson approves
4. Should see signature displayed on withdrawal card
5. Should see name displayed with signature

### Test 5: Receipt with Signature
1. All 3 signatories approve
2. B2C transfer initiated
3. Receipt generated
4. Receipt should include all 3 signatures
5. Receipt should include all 3 names

---

## 🚀 Deployment Checklist

- [ ] Run migration: `supabase migration up 20260512_signatory_signatures.sql`
- [ ] Add route to `App.tsx`
- [ ] Add menu item to `AdminLayout.tsx`
- [ ] Import `SignatorySignatureUpload` component
- [ ] Import `Upload` icon from lucide-react
- [ ] Build project: `npm run build`
- [ ] Test signature upload
- [ ] Test signature display on withdrawal
- [ ] Test receipt generation
- [ ] Deploy to production

---

## 📁 Files to Modify

### 1. src/App.tsx
**Add**:
```tsx
import SignatorySignatureUpload from '@/pages/admin/SignatorySignatureUpload';
```

**Add route**:
```tsx
{
  path: '/admin/signatory-signature',
  element: <SignatorySignatureUpload />,
}
```

### 2. src/components/layout/AdminLayout.tsx
**Add**:
```tsx
import { Upload } from 'lucide-react';
```

**Add menu item**:
```tsx
{
  icon: <Upload className="h-5 w-5" />,
  label: 'Upload Signature',
  href: '/admin/signatory-signature',
}
```

---

## 🔍 Verification

### Check Route Works
```bash
# Build
npm run build

# Check for errors
# Should see: "✓ built in X.XXs"
```

### Check Database
```sql
-- Verify table exists
SELECT * FROM signatory_signatures;

-- Verify RLS enabled
SELECT rowsecurity FROM pg_tables 
WHERE tablename = 'signatory_signatures';

-- Should return: true
```

### Check Component
```bash
# Check component file exists
ls -la src/pages/admin/SignatorySignatureUpload.tsx

# Should show the file
```

---

## 🎯 Next Steps

1. **Integrate into App**
   - Add route to App.tsx
   - Add menu item to AdminLayout.tsx

2. **Build and Test**
   - Run `npm run build`
   - Test signature upload
   - Test signature display

3. **Deploy**
   - Deploy to production
   - Test in production environment

4. **Monitor**
   - Check for errors
   - Monitor signature uploads
   - Verify receipts generated correctly

---

## 📞 Support

### If Route Not Working
- Check import statement
- Check path is correct
- Check component file exists
- Check for TypeScript errors

### If Menu Item Not Showing
- Check import statement
- Check menu items array
- Check role-based access (if configured)
- Check for TypeScript errors

### If Signature Not Uploading
- Check storage bucket exists
- Check RLS policies
- Check file size < 2MB
- Check file type is image

### If Signature Not Displaying
- Check signature_url in database
- Check RLS policies allow access
- Check storage bucket is public
- Check image URL is valid

---

## 📝 Notes

- Signatures are stored in `signatures/signatory-signatures/` folder
- File naming: `{role}-signature-{user_id}-{timestamp}.{ext}`
- Max file size: 2MB
- Supported formats: PNG, JPG, JPEG
- Each user can have one signature per role
- Signatures are unique per user + role combination

---

**Version**: 1.0.0
**Date**: May 12, 2026
**Status**: Ready for Integration
