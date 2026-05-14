# PENALTY WALLET - UI COMPONENTS REFERENCE

## Required Shadcn/UI Components

All components used are from shadcn/ui. Ensure these are installed:

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add table
npx shadcn-ui@latest add badge
```

---

## Component Breakdown

### 1. PayPenalty.tsx (Member Page)

**Imports:**
```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';
```

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Pay Penalties                                           │
│ You have X outstanding penalties to pay                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Status Alert (if applicable)                            │
└─────────────────────────────────────────────────────────┘

┌──────────────────────────────┬──────────────────────────┐
│ Outstanding Penalties        │ Payment Summary          │
│ ┌────────────────────────┐   │ ┌────────────────────┐   │
│ │ □ Penalty 1 - KES 500 │   │ │ Penalties: 2       │   │
│ │ □ Penalty 2 - KES 300 │   │ │ Total: KES 800     │   │
│ │ □ Penalty 3 - KES 200 │   │ │                    │   │
│ │                        │   │ │ Phone: [input]     │   │
│ │ [Select All]           │   │ │                    │   │
│ └────────────────────────┘   │ │ [Pay KES 800]      │   │
│                              │ │                    │   │
│                              │ │ ✓ Secure M-Pesa    │   │
│                              │ │ ✓ Instant verify   │   │
│                              │ │ ✓ Receipt sent     │   │
│                              │ └────────────────────┘   │
└──────────────────────────────┴──────────────────────────┘
```

**Key Elements:**
- Penalty list with checkboxes
- Select/Deselect all button
- Phone number input
- Payment summary
- Total amount display
- Pay button
- Info boxes

---

### 2. PenaltyWallet.tsx (Admin Page)

**Imports:**
```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle, Wallet, ArrowUp } from 'lucide-react';
import { toast } from 'sonner';
```

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Penalty Wallet                                          │
│ Manage penalty payments and withdrawals                │
└─────────────────────────────────────────────────────────┘

┌──────────────┬──────────────┬──────────────┐
│ Total Balance│ Total Received│ Total Withdrawn│
│ KES 50,000   │ KES 100,000   │ KES 50,000    │
└──────────────┴──────────────┴──────────────┘

[Request Withdrawal]

┌─────────────────────────────────────────────────────────┐
│ Withdrawal Requests                                     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ KES 25,000 - Office Supplies          [Pending]    │ │
│ │ Chairperson: [Pending]                             │ │
│ │ Secretary: [Approved]                              │ │
│ │ Treasurer: [Pending]                               │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Recent Penalty Payments                                 │
│ ┌──────────┬────────┬──────────┬──────────┬──────────┐ │
│ │ Member   │ Amount │ Status   │ Ref      │ Date     │ │
│ ├──────────┼────────┼──────────┼──────────┼──────────┤ │
│ │ John Doe │ 500    │ Verified │ ABC123   │ 2026-05-12│ │
│ └──────────┴────────┴──────────┴──────────┴──────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Key Elements:**
- Balance cards (3 columns)
- Request withdrawal button
- Withdrawal requests list
- Signatory status display
- Recent payments table
- Withdrawal dialog

---

### 3. WithdrawalApproval.tsx (Signatory Page)

**Imports:**
```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle, XCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
```

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Withdrawal Approvals                                    │
│ Review and approve as Chairperson                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Pending Approvals: 2                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ KES 25,000                          [Pending Your Approval]
│ Office Supplies Purchase                                │
│                                                         │
│ Requested: 2026-05-12 10:30 AM                         │
│ Reason: Office Supplies Purchase                        │
│                                                         │
│ Approval Status:                                        │
│ ✓ Chairperson: Approved                                │
│ ⏳ Secretary: Pending                                   │
│ ⏳ Treasurer: Pending                                   │
│                                                         │
│ [Approve]  [Reject]                                    │
└─────────────────────────────────────────────────────────┘
```

**Key Elements:**
- Pending approvals count
- Withdrawal cards
- Withdrawal details
- Signatory status list
- Approve/Reject buttons
- Approval dialog
- Rejection reason input

---

## Dialog Components

### Withdrawal Request Dialog

```
┌─────────────────────────────────────────┐
│ Request Penalty Wallet Withdrawal       │
│ Submit a withdrawal request that        │
│ requires approval from 3 signatories    │
├─────────────────────────────────────────┤
│                                         │
│ Available Balance: KES 50,000           │
│                                         │
│ Withdrawal Amount                       │
│ [________________]                      │
│                                         │
│ Reason for Withdrawal                   │
│ [_____________________________]          │
│ [_____________________________]          │
│ [_____________________________]          │
│                                         │
│ [Cancel]  [Submit for Approval]         │
└─────────────────────────────────────────┘
```

### Approval Dialog

```
┌─────────────────────────────────────────┐
│ Approve Withdrawal Request              │
│ Amount: KES 25,000                      │
├─────────────────────────────────────────┤
│                                         │
│ By approving, you confirm that this     │
│ withdrawal is authorized and legitimate │
│                                         │
│ [Cancel]  [Approve]                     │
└─────────────────────────────────────────┘
```

### Rejection Dialog

```
┌─────────────────────────────────────────┐
│ Reject Withdrawal Request               │
│ Amount: KES 25,000                      │
├─────────────────────────────────────────┤
│                                         │
│ Rejection Reason                        │
│ [_____________________________]          │
│ [_____________________________]          │
│ [_____________________________]          │
│                                         │
│ [Cancel]  [Reject]                      │
└─────────────────────────────────────────┘
```

---

## Badge Variants

### Status Badges

```
[Pending]     - secondary (gray)
[Approved]    - default (blue)
[Rejected]    - destructive (red)
[Completed]   - default (blue)
[Verified]    - default (blue)
[Failed]      - destructive (red)
```

### Signatory Status Badges

```
[Pending]     - outline (gray border)
[Approved]    - default (blue)
[Rejected]    - destructive (red)
```

---

## Icons Used

```tsx
import { 
  Loader2,        // Loading spinner
  AlertCircle,    // Alert/warning
  CheckCircle,    // Success/approved
  XCircle,        // Error/rejected
  Phone,          // Phone input
  Wallet,         // Wallet balance
  ArrowUp,        // Withdrawal/outgoing
  FileText,       // Receipt/document
  CreditCard,     // Payment
} from 'lucide-react';
```

---

## Color Scheme

### Status Colors
- **Pending**: Yellow/Orange (#FFA500)
- **Approved**: Green (#22C55E)
- **Rejected**: Red (#EF4444)
- **Completed**: Blue (#3B82F6)
- **Verified**: Green (#22C55E)
- **Failed**: Red (#EF4444)

### Card Colors
- **Balance Cards**: Light blue background
- **Alert Cards**: Light red/yellow background
- **Info Cards**: Light gray background

---

## Responsive Design

### Mobile (< 768px)
- Single column layout
- Full-width buttons
- Stacked cards
- Scrollable tables

### Tablet (768px - 1024px)
- 2 column layout
- Side-by-side cards
- Responsive tables

### Desktop (> 1024px)
- 3 column layout
- Full layout
- All features visible

---

## Accessibility Features

- ✅ Semantic HTML
- ✅ ARIA labels
- ✅ Keyboard navigation
- ✅ Color contrast
- ✅ Focus indicators
- ✅ Loading states
- ✅ Error messages
- ✅ Success feedback

---

## Animation & Transitions

- Loading spinner on buttons
- Smooth transitions on dialogs
- Toast notifications
- Status badge updates
- Real-time polling feedback

---

## Form Validation

### Phone Number Input
- Format validation
- Length validation
- Numeric validation
- Auto-formatting

### Amount Input
- Numeric validation
- Positive number validation
- Balance validation
- Decimal support

### Reason Input
- Required field
- Min length validation
- Max length validation

---

## Error Handling

### User Feedback
- Toast notifications
- Alert boxes
- Inline error messages
- Loading states
- Disabled buttons

### Error Types
- Network errors
- Validation errors
- Authorization errors
- Payment errors
- Approval errors

---

## Success Feedback

- ✅ Toast notifications
- ✅ Success alerts
- ✅ Status updates
- ✅ Redirect on completion
- ✅ Confirmation messages

---

## Loading States

- Spinner on buttons
- Disabled inputs during processing
- Loading skeleton (optional)
- Progress indicators
- Timeout handling

---

## Notification System

Uses `sonner` toast library:

```tsx
toast.success('Payment verified successfully!');
toast.error('Failed to process payment');
toast.loading('Processing...');
toast.promise(promise, {
  loading: 'Loading...',
  success: 'Success!',
  error: 'Error!'
});
```

---

## Styling

All components use Tailwind CSS with shadcn/ui defaults:
- Consistent spacing
- Consistent colors
- Consistent typography
- Responsive design
- Dark mode support (if enabled)

---

## Component Props

### Button Props
```tsx
<Button
  onClick={handleClick}
  disabled={isLoading}
  variant="default" | "outline" | "destructive"
  size="sm" | "default" | "lg"
  className="custom-class"
>
  Button Text
</Button>
```

### Card Props
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
</Card>
```

### Input Props
```tsx
<Input
  type="text" | "number" | "tel" | "email"
  placeholder="Placeholder text"
  value={value}
  onChange={handleChange}
  disabled={isDisabled}
  className="custom-class"
/>
```

### Dialog Props
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    Content here
  </DialogContent>
</Dialog>
```

---

## Best Practices

1. **Consistency**: Use same components throughout
2. **Accessibility**: Always include labels and descriptions
3. **Feedback**: Provide clear user feedback
4. **Performance**: Optimize re-renders
5. **Responsive**: Test on all screen sizes
6. **Error Handling**: Handle all error cases
7. **Loading States**: Show loading indicators
8. **Validation**: Validate all inputs
9. **Security**: Sanitize user input
10. **Testing**: Test all user flows
