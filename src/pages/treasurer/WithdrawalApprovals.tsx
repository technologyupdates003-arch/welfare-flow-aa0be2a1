import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle, XCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { initiateB2CWithdrawal } from '@/lib/b2c';

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
  signatory_role: string;
  status: string;
  signature_url?: string;
  approved_at?: string;
  rejected_at?: string;
  signatory_user_id?: string;
  signatureInfo?: any;
}

export default function TreasurerWithdrawalApprovals() {
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null);

  // Fetch withdrawal requests for treasurer
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Get withdrawal requests where user is a treasurer signatory
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
              signatory_role,
              status,
              signature_url,
              approved_at,
              rejected_at,
              signatory_user_id
            )
          `
          )
          .eq('withdrawal_signatories.signatory_role', 'treasurer')
          .eq('withdrawal_signatories.status', 'pending')
          .or(`withdrawal_signatories.signatory_user_id.eq.${user.id},withdrawal_signatories.signatory_user_id.is.null`)
          .order('created_at', { ascending: false });

        if (withdrawalsError) throw withdrawalsError;

        // Fetch signatory signatures
        const { data: signaturesData } = await supabase
          .from('signatory_signatures')
          .select('user_id, signatory_role, signature_url, full_name');

        const signaturesMap = new Map();
        signaturesData?.forEach((sig: any) => {
          signaturesMap.set(`${sig.user_id}-${sig.signatory_role}`, sig);
          signaturesMap.set(`${sig.signatory_role}`, sig);
        });

        const getSignatureInfo = (s: any) =>
          signaturesMap.get(
            s.signatory_user_id
              ? `${s.signatory_user_id}-${s.signatory_role}`
              : s.signatory_role
          ) || signaturesMap.get(s.signatory_role);

        // Filter to only show withdrawals where user is treasurer signatory
        const filteredWithdrawals = withdrawalsData?.filter((w: any) => {
          return w.withdrawal_signatories?.some(
            (s: any) => s.signatory_role === 'treasurer' && (!s.signatory_user_id || s.signatory_user_id === user.id)
          );
        }) || [];

        setWithdrawals(
          filteredWithdrawals.map((w: any) => ({
            ...w,
            signatories: w.withdrawal_signatories?.map((s: any) => ({
              ...s,
              signatureInfo: getSignatureInfo(s),
            })),
          }))
        );
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load withdrawal requests');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Get pending withdrawals for treasurer
  const getPendingWithdrawals = (): WithdrawalRequest[] => {
    return withdrawals.filter((w) => {
      const treasurerSignatory = w.signatories?.find(
        (s) => s.signatory_role === 'treasurer' && s.status === 'pending'
      );
      return !!treasurerSignatory;
    });
  };

  // Handle approval
  const handleApproval = async (action: 'approve' | 'reject') => {
    if (!selectedWithdrawal || !user) return;

    if (action === 'reject' && !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setProcessing(true);

      // Update signatory status
      const { error: updateError } = await (supabase
        .from('withdrawal_signatories') as any)
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          [action === 'approve' ? 'approved_at' : 'rejected_at']: new Date().toISOString(),
          rejection_reason: action === 'reject' ? rejectionReason : null,
        })
        .eq('withdrawal_id', selectedWithdrawal.id)
        .eq('signatory_role', 'treasurer')
        .or(`signatory_user_id.eq.${user.id},signatory_user_id.is.null`);

      if (updateError) throw updateError;

      // Check if all signatories have approved
      const { data: allSignatories } = await supabase
        .from('withdrawal_signatories')
        .select('status')
        .eq('withdrawal_id', selectedWithdrawal.id);

      const allApproved = allSignatories?.every((s) => s.status === 'approved');
      const anyRejected = allSignatories?.some((s) => s.status === 'rejected');

      // Update withdrawal status
      if (allApproved) {
        toast.loading('Processing B2C transfer...');

        const b2cResult = await initiateB2CWithdrawal({
          withdrawalId: selectedWithdrawal.id,
          amount: selectedWithdrawal.amount,
          phoneNumber: selectedWithdrawal.phone_number || '',
          reason: selectedWithdrawal.reason,
          adminName: user.email || 'Admin',
        });

        if (b2cResult.success) {
          await supabase
            .from('penalty_withdrawals')
            .update({
              status: 'completed',
              submitted_at: new Date().toISOString(),
            })
            .eq('id', selectedWithdrawal.id);

          toast.success(
            `✅ Withdrawal completed! KES ${selectedWithdrawal.amount.toLocaleString()} transferred to ${selectedWithdrawal.phone_number}`
          );
        } else {
          await supabase
            .from('penalty_withdrawals')
            .update({
              status: 'approved',
              submitted_at: new Date().toISOString(),
            })
            .eq('id', selectedWithdrawal.id);

          toast.error(`Approval complete but transfer failed: ${b2cResult.error}`);
        }
      } else if (anyRejected) {
        await supabase
          .from('penalty_withdrawals')
          .update({
            status: 'rejected',
          })
          .eq('id', selectedWithdrawal.id);

        toast.error('Withdrawal rejected');
      } else {
        toast.success(`Withdrawal ${action === 'approve' ? 'approved' : 'rejected'} by you`);
      }

      // Refresh data
      setShowApprovalDialog(false);
      setSelectedWithdrawal(null);
      setRejectionReason('');

      const { data: updatedWithdrawals, error: updatedError } = await supabase
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
            signatory_role,
            status,
            signature_url,
            approved_at,
            rejected_at,
            signatory_user_id
          )
        `
        )
        .eq('withdrawal_signatories.signatory_role', 'treasurer')
        .eq('withdrawal_signatories.status', 'pending')
        .or(`withdrawal_signatories.signatory_user_id.eq.${user.id},withdrawal_signatories.signatory_user_id.is.null`)
        .order('created_at', { ascending: false });

      if (updatedError) throw updatedError;

      const { data: signaturesData } = await supabase
        .from('signatory_signatures')
        .select('user_id, signatory_role, signature_url, full_name');

      const signaturesMap = new Map();
      signaturesData?.forEach((sig: any) => {
        signaturesMap.set(`${sig.user_id}-${sig.signatory_role}`, sig);
        signaturesMap.set(`${sig.signatory_role}`, sig);
      });

      const getSignatureInfo = (s: any) =>
        signaturesMap.get(
          s.signatory_user_id
            ? `${s.signatory_user_id}-${s.signatory_role}`
            : s.signatory_role
        ) || signaturesMap.get(s.signatory_role);

      const filteredWithdrawals = updatedWithdrawals?.filter((w: any) => {
        return w.withdrawal_signatories?.some(
          (s: any) => s.signatory_role === 'treasurer' && (!s.signatory_user_id || s.signatory_user_id === user.id)
        );
      }) || [];

      setWithdrawals(
        filteredWithdrawals.map((w: any) => ({
          ...w,
          signatories: w.withdrawal_signatories?.map((s: any) => ({
            ...s,
            signatureInfo: getSignatureInfo(s),
          })),
        }))
      );
    } catch (error) {
      console.error('Error processing approval:', error);
      toast.error('Failed to process approval');
    } finally {
      setProcessing(false);
    }
  };

  const safeHtml = (value: string) =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

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
          const signatureInfo = sig.signatureInfo;
          const signerName = safeHtml(
            signatureInfo?.full_name || `${sig.signatory_role.charAt(0).toUpperCase()}${sig.signatory_role.slice(1)}`
          );
          const signatureImg = signatureInfo?.signature_url
            ? `<img src="${safeHtml(signatureInfo.signature_url)}" alt="${signerName}" style="max-width:240px;max-height:80px;margin-top:8px;" />`
            : '<div style="margin-top:8px;height:60px;border-bottom:1px solid #9ca3af;width:240px"></div>';
          return `
            <div style="margin-bottom:20px;">
              <div style="font-size:12px;font-weight:700;text-transform:capitalize;">${safeHtml(sig.signatory_role)}</div>
              <div style="font-size:11px;color:#4b5563;">Status: ${safeHtml(sig.status)}</div>
              <div style="font-size:12px;margin-top:8px;">${signerName}</div>
              ${signatureImg}
            </div>
          `;
        })
        .join('');

      container.innerHTML = `
        <div style="border-bottom:3px solid #f59e0b;padding-bottom:12px;margin-bottom:18px;">
          <h1 style="font-size:20px;margin:0;">Penalty Wallet Withdrawal Receipt</h1>
        </div>
        <div style="font-size:12px;line-height:1.6;">
          <p><strong>Withdrawal ID:</strong> ${safeHtml(withdrawal.id)}</p>
          <p><strong>Amount:</strong> KES ${withdrawal.amount.toLocaleString()}</p>
          <p><strong>Reason:</strong> ${safeHtml(withdrawal.reason)}</p>
          <p><strong>Status:</strong> ${safeHtml(withdrawal.status)}</p>
          <p><strong>Requested:</strong> ${safeHtml(new Date(withdrawal.created_at).toLocaleString())}</p>
          ${withdrawal.phone_number ? `<p><strong>Transfer to:</strong> ${safeHtml(withdrawal.phone_number)}</p>` : ''}
        </div>
        <div style="margin-top:22px;">
          <div style="font-size:14px;font-weight:700;margin-bottom:12px;">Approvals</div>
          ${approvalsHtml}
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

  const pendingWithdrawals = getPendingWithdrawals();

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
        <h1 className="text-3xl font-bold">Withdrawal Approvals</h1>
        <p className="text-gray-600 mt-2">
          Review and approve penalty wallet withdrawal requests
        </p>
      </div>

      {/* Pending Approvals Count */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600">Pending Approvals</p>
              <p className="text-3xl font-bold text-blue-900">{pendingWithdrawals.length}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-400 opacity-50" />
          </div>
        </CardContent>
      </Card>

      {/* Pending Withdrawals */}
      {pendingWithdrawals.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-600 py-8">No pending approvals for you</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingWithdrawals.map((withdrawal) => (
            <Card key={withdrawal.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>KES {withdrawal.amount.toLocaleString()}</CardTitle>
                    <CardDescription>{withdrawal.reason}</CardDescription>
                  </div>
                  <Badge variant="secondary">Pending Your Approval</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Withdrawal Details */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Requested:</span>{' '}
                    {new Date(withdrawal.created_at).toLocaleString()}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Reason:</span> {withdrawal.reason}
                  </p>
                  {withdrawal.phone_number && (
                    <p className="text-sm">
                      <span className="font-medium">Transfer to:</span> {withdrawal.phone_number}
                    </p>
                  )}
                </div>

                {/* Signatories Status */}
                <div className="space-y-2">
                  <p className="font-medium text-sm">Approval Status:</p>
                  <div className="space-y-3">
                    {withdrawal.signatories?.map((sig: any) => (
                      <div
                        key={sig.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200"
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          {sig.status === 'approved' && (
                            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                          )}
                          {sig.status === 'rejected' && (
                            <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                          )}
                          {sig.status === 'pending' && (
                            <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <p className="capitalize font-medium">{sig.signatory_role}</p>
                            {sig.signatureInfo?.full_name && (
                              <p className="text-xs text-muted-foreground">{sig.signatureInfo.full_name}</p>
                            )}
                            {sig.status === 'approved' && sig.signatureInfo?.signature_url && (
                              <div className="mt-2">
                                <img
                                  src={sig.signatureInfo.signature_url}
                                  alt={`${sig.signatory_role} signature`}
                                  className="h-12 object-contain"
                                />
                              </div>
                            )}
                          </div>
                        </div>
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

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 pt-4 sm:flex-row">
                  <Button
                    variant="default"
                    onClick={() => {
                      setSelectedWithdrawal(withdrawal);
                      setApprovalAction('approve');
                      setShowApprovalDialog(true);
                    }}
                    className="flex-1"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setSelectedWithdrawal(withdrawal);
                      setApprovalAction('reject');
                      setShowApprovalDialog(true);
                    }}
                    className="flex-1"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => downloadReceipt(withdrawal)}
                  className="mt-3"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Download Receipt
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' ? 'Approve' : 'Reject'} Withdrawal Request
            </DialogTitle>
            <DialogDescription>
              Amount: KES {selectedWithdrawal?.amount.toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {approvalAction === 'reject' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Rejection Reason</label>
                <Textarea
                  placeholder="Explain why you are rejecting this withdrawal"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  disabled={processing}
                  rows={4}
                />
              </div>
            )}

            {approvalAction === 'approve' && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  By approving, you confirm that this withdrawal is authorized and legitimate.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowApprovalDialog(false)}
                disabled={processing}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleApproval(approvalAction || 'approve')}
                disabled={processing || (approvalAction === 'reject' && !rejectionReason)}
                variant={approvalAction === 'reject' ? 'destructive' : 'default'}
                className="flex-1"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `${approvalAction === 'approve' ? 'Approve' : 'Reject'}`
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
