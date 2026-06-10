import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle, Wallet, ArrowUp, Phone, TrendingUp, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { validatePhoneNumber } from '@/lib/b2c';

interface WalletBalance {
  total_balance: number;
  total_received: number;
  total_withdrawn: number;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  reason: string;
  status: string;
  requested_by: string;
  submitted_at: string;
  created_at: string;
  phone_number?: string;
  signatories: SignatoryInfo[];
}

interface SignatoryInfo {
  id: string;
  signatory_user_id?: string;
  signatory_role: string;
  status: string;
  signature_url?: string;
}

interface PenaltyPayment {
  id: string;
  member_id: string;
  amount: number;
  status: string;
  payment_ref?: string;
  verified_at?: string;
  created_at: string;
  member_name: string;
}

export default function PenaltyWallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [payments, setPayments] = useState<PenaltyPayment[]>([]);
  const [signatureMap, setSignatureMap] = useState<Map<string, any>>(new Map());
  const [orgSettings, setOrgSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalReason, setWithdrawalReason] = useState('');
  const [withdrawalPhone, setWithdrawalPhone] = useState('');
  const [showWithdrawalDialog, setShowWithdrawalDialog] = useState(false);

  // Fetch wallet data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch organization settings for letterhead
        const { data: orgSettings } = await supabase
          .from('organization_settings')
          .select('*')
          .single();

        const { data: walletRow, error: walletError } = await supabase
          .from('penalty_wallet')
          .select('total_balance, total_received, total_withdrawn')
          .limit(1)
          .maybeSingle();

        if (walletError) {
          console.error('Error fetching wallet data:', walletError);
        }

        // Store org settings for use in receipt generation
        setOrgSettings(orgSettings);

        const walletData = {
          total_balance: Number(walletRow?.total_balance || 0),
          total_received: Number(walletRow?.total_received || 0),
          total_withdrawn: Number(walletRow?.total_withdrawn || 0),
        };

        setWallet(walletData);

        // Get withdrawal requests
        const { data: withdrawalsData, error: withdrawalsError } = await supabase
          .from('penalty_withdrawals')
          .select(
            `
            id,
            amount,
            reason,
            status,
            requested_by,
            submitted_at,
            created_at,
            phone_number,
            withdrawal_signatories (
              id,
              signatory_user_id,
              signatory_role,
              status,
              signature_url
            )
          `
          )
          .order('created_at', { ascending: false });

        if (withdrawalsError) throw withdrawalsError;

        // Get signatory signatures for receipt generation and signature matching
        const { data: signaturesData, error: signaturesError } = await supabase
          .from('signatory_signatures')
          .select('user_id, signatory_role, signature_url, full_name');

        if (signaturesError) throw signaturesError;

        const signatureInfoMap = new Map<string, any>();
        signaturesData?.forEach((sig: any) => {
          if (sig.user_id) {
            signatureInfoMap.set(`${sig.user_id}-${sig.signatory_role}`, sig);
          }
          signatureInfoMap.set(sig.signatory_role, sig);
        });
        setSignatureMap(signatureInfoMap);

        setWithdrawals(
          withdrawalsData?.map((w: any) => ({
            ...w,
            signatories: w.withdrawal_signatories,
          })) || []
        );

        // Get penalty payments
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('penalty_payment_records')
          .select(
            `
            id,
            member_id,
            amount,
            status,
            payment_ref,
            verified_at,
            created_at,
            members (name)
          `
          )
          .order('created_at', { ascending: false })
          .limit(20);

        if (paymentsError) throw paymentsError;

        setPayments(
          paymentsData?.map((p: any) => ({
            ...p,
            member_name: p.members?.name || 'Unknown',
          })) || []
        );
      } catch (error) {
        console.error('Error fetching wallet data:', error);
        toast.error('Failed to load wallet information');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle withdrawal request
  const handleWithdrawalRequest = async () => {
    if (!withdrawalAmount || !withdrawalReason.trim() || !withdrawalPhone.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    if (!validatePhoneNumber(withdrawalPhone)) {
      toast.error('Invalid phone number. Use format: 0712345678 or +254712345678');
      return;
    }

    const amount = parseFloat(withdrawalAmount);
    if (amount <= 0 || !wallet || amount > wallet.total_balance) {
      toast.error('Invalid amount or insufficient balance');
      return;
    }

    try {
      setSubmitting(true);

      // Create withdrawal request with phone number
      const { data: withdrawalData, error: withdrawalError } = await supabase
        .from('penalty_withdrawals')
        .insert({
          amount,
          reason: withdrawalReason,
          requested_by: user?.id,
          status: 'pending',
          phone_number: withdrawalPhone,
        })
        .select()
        .single();

      if (withdrawalError) throw withdrawalError;

      // Create signatory records for chairperson, secretary, and treasurer
      const signatories = ['chairperson', 'secretary', 'treasurer'];
      const { error: signatoriesError } = await (supabase
        .from('withdrawal_signatories') as any)
        .insert(
          signatories.map((role) => ({
            withdrawal_id: withdrawalData.id,
            signatory_role: role,
            status: 'pending',
          }))
        );

      if (signatoriesError) throw signatoriesError;

      toast.success('Withdrawal request submitted for approval');
      setWithdrawalAmount('');
      setWithdrawalReason('');
      setWithdrawalPhone('');
      setShowWithdrawalDialog(false);

      // Refresh data
      const { data: updatedWithdrawals } = await supabase
        .from('penalty_withdrawals')
        .select(
          `
          id,
          amount,
          reason,
          status,
          requested_by,
          submitted_at,
          created_at,
          phone_number,
          withdrawal_signatories (
            id,
            signatory_user_id,
            signatory_role,
            status,
            signature_url
          )
        `
        )
        .order('created_at', { ascending: false });

      setWithdrawals(
        updatedWithdrawals?.map((w: any) => ({
          ...w,
          signatories: w.withdrawal_signatories,
        })) || []
      );
    } catch (error) {
      console.error('Error submitting withdrawal request:', error);
      toast.error('Failed to submit withdrawal request');
    } finally {
      setSubmitting(false);
    }
  };

  const safeHtml = (value: string) =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const getSignatureInfo = (signatory: SignatoryInfo) => {
    if (!signatureMap) return undefined;
    const exactKey = signatory.signatory_user_id
      ? `${signatory.signatory_user_id}-${signatory.signatory_role}`
      : null;
    return (
      (exactKey && signatureMap?.get(exactKey)) ||
      signatureMap?.get(signatory.signatory_role)
    );
  };

  const downloadReceipt = async (withdrawal: WithdrawalRequest) => {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const container = document.createElement('div');
      container.style.padding = '24px';
      container.style.background = '#ffffff';
      container.style.color = '#111827';
      container.style.fontFamily = 'Arial, sans-serif';

      const approvalsHtml = withdrawal.signatories
        .map((sig) => {
          const signatureInfo = getSignatureInfo(sig);
          const signerName = signatureInfo?.full_name ||
            `${sig.signatory_role.charAt(0).toUpperCase()}${sig.signatory_role.slice(1)}`;
          const signatureImg = signatureInfo?.signature_url
            ? `<img src="${safeHtml(signatureInfo.signature_url)}" alt="${safeHtml(signerName)}" style="max-width:240px;max-height:80px;margin-top:8px;" />`
            : '<div style="margin-top:8px;height:60px;border-bottom:1px solid #9ca3af;width:240px"></div>';
          return `
            <div style="margin-bottom:20px;">
              <div style="font-size:12px;font-weight:700;text-transform:capitalize;">${safeHtml(sig.signatory_role)}</div>
              <div style="font-size:11px;color:#4b5563;">Status: ${safeHtml(sig.status)}</div>
              <div style="font-size:12px;margin-top:8px;">${safeHtml(signerName)}</div>
              ${signatureImg}
            </div>
          `;
        })
        .join('');

      container.innerHTML = `
        <div style="font-family:'Times New Roman', Times, serif;max-width:900px;margin:0 auto;padding:20px;background:white;color:#111827;">
          <!-- Memo Letterhead Header -->
          <div style="border-bottom:4px solid #f97316;padding-bottom:15px;margin-bottom:20px;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:15px;">
              ${orgSettings?.logo_url ? `<img src="${orgSettings.logo_url}" alt="Logo" style="height:80px;width:80px;object-fit:contain;flex-shrink:0;" />` : ''}
              <div style="flex:1;text-align:right;">
                <h1 style="font-size:16px;font-weight:bold;margin:0 0 5px 0;line-height:1.2;">${safeHtml(orgSettings?.organization_name || 'KHCWW WELFARE')}</h1>
                <div style="font-size:11px;color:#6B7280;line-height:1.4;">
                  <p style="margin:0;">${safeHtml(orgSettings?.organization_address || 'P.O.BOX 24-10300 KERUGOYA')}</p>
                  <p style="margin:3px 0 0 0;color:#f97316;font-weight:500;word-break:break-all;">Email: ${safeHtml(orgSettings?.organization_email || 'welfare@khcww.org')}</p>
                  <p style="margin:3px 0 0 0;">Tel: ${safeHtml(orgSettings?.organization_phone || '+254 712 345 678')}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Receipt Title -->
          <div style="text-align:center;margin-bottom:15px;">
            <p style="font-size:11px;font-weight:bold;color:#f97316;letter-spacing:2px;margin:0;">PENALTY WALLET WITHDRAWAL RECEIPT</p>
          </div>

          <!-- Receipt Details -->
          <div style="margin-bottom:20px;">
            <div style="font-size:11px;color:#6B7280;line-height:1.6;margin-bottom:10px;">
              <p style="margin:0;">Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p style="margin:3px 0 0 0;">Reference: ${safeHtml(withdrawal.id.substring(0, 12))}</p>
            </div>

            <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:15px;">
              <tr style="background:#f3f4f6;">
                <td style="padding:8px;font-weight:600;color:#374151;width:35%;border:1px solid #e5e7eb;">Receipt ID:</td>
                <td style="padding:8px;color:#1f2937;border:1px solid #e5e7eb;font-family:monospace;">${safeHtml(withdrawal.id.substring(0, 12))}...</td>
              </tr>
              <tr>
                <td style="padding:8px;font-weight:600;color:#374151;border:1px solid #e5e7eb;">Withdrawal Amount:</td>
                <td style="padding:8px;color:#059669;font-weight:700;border:1px solid #e5e7eb;">KES ${withdrawal.amount.toLocaleString()}</td>
              </tr>
              <tr style="background:#f3f4f6;">
                <td style="padding:8px;font-weight:600;color:#374151;border:1px solid #e5e7eb;">Reason:</td>
                <td style="padding:8px;color:#1f2937;border:1px solid #e5e7eb;">${safeHtml(withdrawal.reason)}</td>
              </tr>
              <tr>
                <td style="padding:8px;font-weight:600;color:#374151;border:1px solid #e5e7eb;">Status:</td>
                <td style="padding:8px;border:1px solid #e5e7eb;"><span style="background:#dbeafe;color:#1e40af;padding:3px 6px;border-radius:3px;font-size:10px;font-weight:600;">${safeHtml(withdrawal.status.toUpperCase())}</span></td>
              </tr>
              <tr style="background:#f3f4f6;">
                <td style="padding:8px;font-weight:600;color:#374151;border:1px solid #e5e7eb;">Date Issued:</td>
                <td style="padding:8px;color:#1f2937;border:1px solid #e5e7eb;">${safeHtml(new Date(withdrawal.created_at).toLocaleString())}</td>
              </tr>
              ${withdrawal.phone_number ? `
              <tr>
                <td style="padding:8px;font-weight:600;color:#374151;border:1px solid #e5e7eb;">Transfer To:</td>
                <td style="padding:8px;color:#1f2937;border:1px solid #e5e7eb;font-family:monospace;">${safeHtml(withdrawal.phone_number)}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          <!-- Approvals Section -->
          <div style="margin-top:30px;padding-top:20px;border-top:2px solid #e5e7eb;">
            <p style="font-size:11px;font-weight:bold;margin:0 0 15px 0;">APPROVAL SIGNATURES</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;font-size:10px;">
              ${approvalsHtml}
            </div>
          </div>

          <!-- Footer -->
          <div style="margin-top:30px;padding-top:15px;border-top:1px solid #e5e7eb;text-align:center;">
            <div style="font-size:10px;color:#6B7280;line-height:1.6;">
              <p style="margin:0;font-weight:600;">${safeHtml(orgSettings?.organization_name || 'KHCWW WELFARE')}</p>
              <p style="margin:3px 0 0 0;">${safeHtml(orgSettings?.organization_address || 'P.O.BOX 24-10300 KERUGOYA')}</p>
              <p style="margin:3px 0 0 0;word-break:break-all;">Email: ${safeHtml(orgSettings?.organization_email || 'welfare@khcww.org')} | Tel: ${safeHtml(orgSettings?.organization_phone || '+254 712 345 678')}</p>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(container);
      await html2pdf()
        .set({ margin: 10, filename: `withdrawal-receipt-${withdrawal.id}.pdf`, html2canvas: { scale: 2 } })
        .from(container)
        .save();
      document.body.removeChild(container);
    } catch (error) {
      console.error('Receipt download error:', error);
      toast.error('Unable to generate receipt');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Penalty Wallet</h1>
        <p className="text-gray-600 mt-2">Manage penalty payments and withdrawals</p>
      </div>

      {/* Wallet Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">
                  KES {wallet?.total_balance?.toLocaleString() || '0'}
                </p>
              </div>
              <Wallet className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Received</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">
                  KES {wallet?.total_received?.toLocaleString() || '0'}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Withdrawn</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">
                  KES {wallet?.total_withdrawn?.toLocaleString() || '0'}
                </p>
              </div>
              <ArrowUp className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Withdrawal Request Button */}
      <Dialog open={showWithdrawalDialog} onOpenChange={setShowWithdrawalDialog}>
        <DialogTrigger asChild>
          <Button size="lg" className="w-full md:w-auto">
            <ArrowUp className="mr-2 h-4 w-4" />
            Request Withdrawal
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Request Penalty Wallet Withdrawal
            </DialogTitle>
            <DialogDescription>
              Submit a withdrawal request that requires approval from chairperson, secretary, and treasurer
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Available Balance Alert */}
            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                Available Balance: <span className="font-bold">KES {wallet?.total_balance?.toLocaleString() || '0'}</span>
              </AlertDescription>
            </Alert>

            {/* Amount Input */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Withdrawal Amount</label>
              <div className="relative">
                <TrendingUp className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  disabled={submitting}
                  min="0"
                  step="100"
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-gray-500">Minimum: KES 100</p>
            </div>

            {/* Phone Number Input */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">M-Pesa Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type="tel"
                  placeholder="0712345678"
                  value={withdrawalPhone}
                  onChange={(e) => setWithdrawalPhone(e.target.value)}
                  disabled={submitting}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-gray-500">Format: 0712345678 or +254712345678</p>
            </div>

            {/* Reason Input */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Reason for Withdrawal</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Textarea
                  placeholder="Explain the purpose of this withdrawal (e.g., Office supplies, Maintenance, Staff allowance)"
                  value={withdrawalReason}
                  onChange={(e) => setWithdrawalReason(e.target.value)}
                  disabled={submitting}
                  rows={4}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-gray-500">Be specific about the withdrawal purpose</p>
            </div>

            {/* Info Box */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <p className="text-sm font-semibold text-amber-900">âš ï¸ Important</p>
              <ul className="text-xs text-amber-800 space-y-1">
                <li>â€¢ Requires approval from 3 signatories</li>
                <li>â€¢ Funds will be transferred to the M-Pesa number provided</li>
                <li>â€¢ Transfer happens automatically after all approvals</li>
                <li>â€¢ Receipt will be generated with all signatures</li>
              </ul>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleWithdrawalRequest}
              disabled={submitting || !withdrawalAmount || !withdrawalReason || !withdrawalPhone}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <ArrowUp className="mr-2 h-4 w-4" />
                  Submit for Approval
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal Requests</CardTitle>
          <CardDescription>Pending and completed withdrawal requests</CardDescription>
        </CardHeader>
        <CardContent>
          {withdrawals.length === 0 ? (
            <p className="text-gray-600 text-center py-8">No withdrawal requests yet</p>
          ) : (
            <div className="space-y-4">
              {withdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-lg">KES {withdrawal.amount.toLocaleString()}</p>
                      <p className="text-sm text-gray-600">{withdrawal.reason}</p>
                    </div>
                    <Badge
                      variant={
                        withdrawal.status === 'completed'
                          ? 'default'
                          : withdrawal.status === 'rejected'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {withdrawal.status}
                    </Badge>
                  </div>

                  {/* Phone Number Display */}
                  {withdrawal.phone_number && (
                    <div className="flex items-center gap-2 text-sm bg-blue-50 p-2 rounded">
                      <Phone className="h-4 w-4 text-blue-600" />
                      <span className="text-blue-900">
                        <strong>Transfer to:</strong> {withdrawal.phone_number}
                      </span>
                    </div>
                  )}

                  {/* Signatories Status */}
                  <div className="bg-gray-50 p-3 rounded space-y-2">
                    <p className="text-sm font-medium">Approvals Required:</p>
                    <div className="space-y-1">
                      {withdrawal.signatories?.map((sig: any) => (
                        <div key={sig.id} className="flex items-center justify-between text-sm">
                          <span className="capitalize">{sig.signatory_role}</span>
                          <Badge
                            variant={
                              sig.status === 'approved'
                                ? 'default'
                                : sig.status === 'rejected'
                                  ? 'destructive'
                                  : 'outline'
                            }
                          >
                            {sig.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {withdrawal.status === 'completed' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => downloadReceipt(withdrawal)}
                      className="mt-3"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Download Receipt
                    </Button>
                  )}

                  <p className="text-xs text-gray-500">
                    Requested: {new Date(withdrawal.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Penalty Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Penalty Payments</CardTitle>
          <CardDescription>Latest penalty payments received</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-600 py-8">
                      No penalty payments yet
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.member_name}</TableCell>
                      <TableCell>KES {payment.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge
                          variant={payment.status === 'verified' ? 'default' : 'secondary'}
                        >
                          {payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{payment.payment_ref || '-'}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(payment.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

