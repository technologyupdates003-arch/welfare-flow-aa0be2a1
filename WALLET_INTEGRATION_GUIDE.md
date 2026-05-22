# Wallet System Integration Guide

## Quick Start

### 1. Add Operational Wallet to Treasurer Navigation

Update your treasurer navigation/menu to include:

```tsx
// In your treasurer layout or navigation component
import { Link } from 'react-router-dom';

<Link to="/treasurer/operational-wallet">
  <Wallet className="h-4 w-4" />
  Operational Wallet
</Link>

<Link to="/treasurer/wallet-reports">
  <BarChart3 className="h-4 w-4" />
  Wallet Reports
</Link>
```

### 2. Update App Routes

Add these routes to your app router:

```tsx
// In your router configuration
{
  path: '/treasurer/operational-wallet',
  element: <OperationalWallet />
},
{
  path: '/treasurer/wallet-reports',
  element: <WalletReports />
}
```

### 3. Import Components

```tsx
import { WalletStatement } from '@/components/WalletStatement';
import { SignatoryApprovalPanel } from '@/components/withdrawal/SignatoryApprovalPanel';
import { useWithdrawalApproval } from '@/hooks/useWithdrawalApproval';
import { useWalletRealtime } from '@/hooks/useWalletRealtime';
```

---

## Using the Wallet Statement Component

Display transaction history in any page:

```tsx
import { WalletStatement } from '@/components/WalletStatement';

export function MyWalletPage() {
  return (
    <WalletStatement
      walletType="operational"
      dateFrom="2026-01-01"
      dateTo="2026-12-31"
      limit={50}
      onTransactionClick={(tx) => console.log('Clicked:', tx)}
    />
  );
}
```

---

## Using the Signatory Approval Panel

Display signatory status in approval workflows:

```tsx
import { SignatoryApprovalPanel } from '@/components/withdrawal/SignatoryApprovalPanel';

export function WithdrawalDetails({ withdrawal }) {
  return (
    <div className="space-y-4">
      {withdrawal.signatories.map((sig) => (
        <SignatoryApprovalPanel
          key={sig.id}
          signatory={sig}
          showSignature={true}
        />
      ))}
    </div>
  );
}
```

---

## Using the Withdrawal Approval Hook

Handle approval workflows:

```tsx
import { useWithdrawalApproval } from '@/hooks/useWithdrawalApproval';

export function ApprovalDialog({ withdrawal, userRole }) {
  const { approveWithdrawal, rejectWithdrawal, processing } = useWithdrawalApproval();

  const handleApprove = async () => {
    const result = await approveWithdrawal(withdrawal, userRole);
    if (result.success && result.allApproved) {
      console.log('All signatories approved! B2C transfer initiated.');
    }
  };

  const handleReject = async () => {
    const result = await rejectWithdrawal(
      withdrawal,
      userRole,
      "Insufficient documentation"
    );
    if (result.success) {
      console.log('Withdrawal rejected');
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={handleApprove} disabled={processing}>
        Approve
      </button>
      <button onClick={handleReject} disabled={processing}>
        Reject
      </button>
    </div>
  );
}
```

---

## Using Real-time Subscriptions

Subscribe to wallet updates:

```tsx
import { useWalletRealtime } from '@/hooks/useWalletRealtime';

export function OperationalDashboard() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);

  useWalletRealtime('operational', {
    onWalletUpdate: (wallet) => {
      setBalance(wallet.total_balance);
    },
    onTransactionInsert: (tx) => {
      setTransactions(prev => [tx, ...prev]);
    },
    onWithdrawalUpdate: (withdrawal) => {
      console.log('Withdrawal status changed:', withdrawal.status);
    }
  });

  return (
    <div>
      <h2>Balance: {balance}</h2>
      <ul>
        {transactions.map(tx => (
          <li key={tx.id}>{tx.source}: {tx.net_amount}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Calling Edge Functions

### Top-Up Wallet

```tsx
async function topUpWallet() {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/operational-topup`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        type: 'manual',
        amount: 50000,
        notes: 'Monthly operational fund',
        created_by: userId
      })
    }
  );

  const result = await response.json();
  if (result.success) {
    console.log('Top-up recorded:', result.paymentRecord);
  }
}
```

### Write to Wallet Ledger

```tsx
async function recordExpense() {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-ledger-write`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        wallet_type: 'operational',
        direction: 'out',
        source: 'expense',
        reference_id: expenseId,
        reference_table: 'expenses',
        party_name: 'Office Supplies',
        gross_amount: 5000,
        mpesa_charge: 0,
        system_fee: 0,
        status: 'completed',
        notes: 'Office stationery purchase'
      })
    }
  );

  const result = await response.json();
  if (result.success) {
    console.log('Ledger entry created:', result.transaction);
  }
}
```

---

## Updating Existing Pages

### TriggerPayout Page

Add wallet type selector:

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function TriggerPayout() {
  const [walletType, setWalletType] = useState('penalty');

  return (
    <div className="space-y-4">
      <Select value={walletType} onValueChange={setWalletType}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="penalty">Penalty Wallet</SelectItem>
          <SelectItem value="donation">Donation Wallet</SelectItem>
          <SelectItem value="operational">Operational Wallet</SelectItem>
        </SelectContent>
      </Select>

      {/* Rest of form */}
    </div>
  );
}
```

### Expenses Page

Add wallet type and B2C toggle:

```tsx
export function Expenses() {
  const [walletType, setWalletType] = useState('operational');
  const [payViaB2C, setPayViaB2C] = useState(false);

  return (
    <div className="space-y-4">
      <Select value={walletType} onValueChange={setWalletType}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="penalty">Penalty Wallet</SelectItem>
          <SelectItem value="donation">Donation Wallet</SelectItem>
          <SelectItem value="operational">Operational Wallet</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={payViaB2C}
          onChange={(e) => setPayViaB2C(e.target.checked)}
        />
        <label>Pay via B2C Transfer</label>
      </div>

      {/* Rest of form */}
    </div>
  );
}
```

---

## Database Queries

### Get Wallet Balance

```sql
SELECT total_balance FROM operational_wallet LIMIT 1;
```

### Get Recent Transactions

```sql
SELECT * FROM wallet_transactions
WHERE wallet_type = 'operational'
ORDER BY occurred_at DESC
LIMIT 20;
```

### Get Pending Withdrawals

```sql
SELECT w.*, 
  json_agg(s.*) as signatories
FROM operational_withdrawals w
LEFT JOIN operational_withdrawal_signatories s ON w.id = s.withdrawal_id
WHERE w.status = 'pending'
GROUP BY w.id
ORDER BY w.created_at DESC;
```

### Get Approval Status

```sql
SELECT 
  withdrawal_id,
  signatory_role,
  status,
  approved_at
FROM operational_withdrawal_signatories
WHERE withdrawal_id = $1
ORDER BY signatory_role;
```

---

## Error Handling

### Common Errors

**"Insufficient balance"**
```tsx
if (amount > wallet.total_balance) {
  toast.error('Insufficient balance');
  return;
}
```

**"Missing required fields"**
```tsx
if (!amount || !reason || !phone) {
  toast.error('Please fill in all required fields');
  return;
}
```

**"Withdrawal already completed"**
```tsx
if (withdrawal.status === 'completed') {
  toast.info('This withdrawal has already been completed');
  return;
}
```

**"Not all signatories approved"**
```tsx
const allApproved = signatories.every(s => s.status === 'approved');
if (!allApproved) {
  toast.info('Awaiting approval from other signatories');
  return;
}
```

---

## Testing

### Test Wallet Top-Up

```tsx
// Manual top-up
await fetch('/functions/v1/operational-topup', {
  method: 'POST',
  body: JSON.stringify({
    type: 'manual',
    amount: 10000,
    notes: 'Test top-up'
  })
});

// Verify in database
SELECT * FROM operational_wallet;
SELECT * FROM wallet_transactions WHERE source = 'manual_topup';
```

### Test Withdrawal Approval

```tsx
// Create withdrawal
const { data: withdrawal } = await supabase
  .from('operational_withdrawals')
  .insert({
    amount: 5000,
    reason: 'Test withdrawal',
    phone_number: '254712345678',
    requested_by: userId
  })
  .select()
  .single();

// Approve as chairperson
await supabase
  .from('operational_withdrawal_signatories')
  .update({ status: 'approved', approved_at: new Date().toISOString() })
  .eq('withdrawal_id', withdrawal.id)
  .eq('signatory_role', 'chairperson');

// Check if all approved
const { data: signatories } = await supabase
  .from('operational_withdrawal_signatories')
  .select('status')
  .eq('withdrawal_id', withdrawal.id);

const allApproved = signatories.every(s => s.status === 'approved');
```

### Test Real-time Updates

```tsx
// Subscribe to wallet updates
const subscription = supabase
  .channel('test_wallet')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'operational_wallet'
  }, (payload) => {
    console.log('Wallet updated:', payload);
  })
  .subscribe();

// Update wallet in database
await supabase
  .from('operational_wallet')
  .update({ total_balance: 100000 })
  .eq('id', walletId);

// Should see update in console
```

---

## Performance Tips

1. **Pagination**: Use `limit` parameter in WalletStatement for large datasets
2. **Caching**: Cache wallet balance in component state, update via real-time
3. **Debouncing**: Debounce filter changes in WalletReports
4. **Lazy Loading**: Load transaction details on demand
5. **Indexes**: Ensure indexes on wallet_type, occurred_at, status

---

## Security Considerations

1. **RLS Policies**: All tables have RLS enabled
2. **Role-based Access**: Only treasury roles can insert/update
3. **Signature Verification**: Signatures stored in office_bearer_signatures
4. **Audit Trail**: All changes tracked via created_at, updated_at
5. **Phone Normalization**: Prevents injection attacks

---

## Support

For issues or questions:
1. Check UNIFIED_TREASURY_IMPLEMENTATION.md for detailed documentation
2. Review error messages in browser console
3. Check Supabase logs for edge function errors
4. Verify RLS policies are correctly configured
5. Ensure all environment variables are set

---

## Next Steps

1. Deploy edge functions to Supabase
2. Add routes to your app
3. Update treasurer navigation
4. Test with sample data
5. Train users on new features
6. Monitor real-time updates
7. Gather feedback for improvements
