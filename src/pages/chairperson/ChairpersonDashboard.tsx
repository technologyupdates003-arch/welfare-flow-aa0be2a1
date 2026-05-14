import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, AlertTriangle, TrendingUp, Calendar, FileText, CheckCircle, XCircle, Loader2, Clock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { initiateB2CWithdrawal } from "@/lib/b2c";
import StatsCards from "@/components/admin/StatsCards";

export default function ChairpersonDashboard() {
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null);
  const [processing, setProcessing] = useState(false);

  // Fetch pending withdrawal approvals (penalty + donation)
  const fetchWithdrawals = async () => {
    if (!user) return;
    try {
      const [penaltyRes, donationRes] = await Promise.all([
        supabase
          .from('penalty_withdrawals')
          .select(`
            id, amount, reason, status, requested_by, submitted_at, created_at, phone_number,
            withdrawal_signatories ( id, signatory_role, status, signature_url, approved_at, rejected_at, signatory_user_id )
          `)
          .eq('withdrawal_signatories.signatory_role', 'chairperson')
          .eq('withdrawal_signatories.status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('donation_withdrawals')
          .select(`
            id, amount, reason, status, requested_by, submitted_at, created_at, phone_number,
            donation_withdrawal_signatories ( id, signatory_role, status, signature_url, approved_at, rejected_at, signatory_user_id )
          `)
          .eq('donation_withdrawal_signatories.signatory_role', 'chairperson')
          .eq('donation_withdrawal_signatories.status', 'pending')
          .order('created_at', { ascending: false }),
      ]);

      if (penaltyRes.error) throw penaltyRes.error;
      if (donationRes.error) throw donationRes.error;

      const combined = [
        ...(penaltyRes.data || []).map((w: any) => ({ ...w, _type: 'penalty' as const })),
        ...(donationRes.data || []).map((w: any) => ({
          ...w,
          _type: 'donation' as const,
          withdrawal_signatories: w.donation_withdrawal_signatories,
        })),
      ];
      setWithdrawals(combined);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, [user]);

  const getPendingWithdrawals = () => {
    return withdrawals.filter((w) => {
      const chairpersonSignatory = w.withdrawal_signatories?.find(
        (s: any) => s.signatory_role === 'chairperson' && s.status === 'pending'
      );
      return !!chairpersonSignatory;
    });
  };

  const handleApproval = async (action: 'approve' | 'reject') => {
    if (!selectedWithdrawal || !user) return;

    if (action === 'reject' && !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setProcessing(true);

      const isDonation = selectedWithdrawal._type === 'donation';
      const sigTable = isDonation ? 'donation_withdrawal_signatories' : 'withdrawal_signatories';
      const wTable = isDonation ? 'donation_withdrawals' : 'penalty_withdrawals';

      // Pull this user's stored signature so it's prefilled on the receipt
      let mySignatureUrl: string | null = null;
      try {
        const { data: mySig } = await supabase
          .from('signatory_signatures')
          .select('signature_url')
          .eq('user_id', user.id)
          .eq('signatory_role', 'chairperson')
          .maybeSingle();
        mySignatureUrl = (mySig as any)?.signature_url || null;
      } catch (_) { /* ignore */ }

      const updatePayload: any = {
        status: action === 'approve' ? 'approved' : 'rejected',
        [action === 'approve' ? 'approved_at' : 'rejected_at']: new Date().toISOString(),
        rejection_reason: action === 'reject' ? rejectionReason : null,
        signatory_user_id: user.id,
      };
      if (action === 'approve' && mySignatureUrl) {
        updatePayload.signature_url = mySignatureUrl;
      }

      const { error: updateError } = await (supabase
        .from(sigTable) as any)
        .update(updatePayload)
        .eq('withdrawal_id', selectedWithdrawal.id)
        .eq('signatory_role', 'chairperson');

      if (updateError) throw updateError;

      const { data: allSignatories } = await (supabase
        .from(sigTable) as any)
        .select('status')
        .eq('withdrawal_id', selectedWithdrawal.id);

      const allApproved = allSignatories?.every((s: any) => s.status === 'approved');
      const anyRejected = allSignatories?.some((s: any) => s.status === 'rejected');

      if (allApproved) {
        toast.loading('Processing B2C transfer...');

        const b2cResult = await initiateB2CWithdrawal({
          withdrawalId: selectedWithdrawal.id,
          amount: selectedWithdrawal.amount,
          phoneNumber: selectedWithdrawal.phone_number || '',
          reason: selectedWithdrawal.reason,
          adminName: user.email || 'Admin',
          walletType: isDonation ? 'donation' : 'penalty',
        } as any);

        if (b2cResult.success) {
          await (supabase.from(wTable) as any)
            .update({ status: 'completed', submitted_at: new Date().toISOString() })
            .eq('id', selectedWithdrawal.id);

          toast.success(
            `✅ Withdrawal completed! KES ${selectedWithdrawal.amount.toLocaleString()} transferred`
          );
        } else {
          await (supabase.from(wTable) as any)
            .update({ status: 'approved', submitted_at: new Date().toISOString() })
            .eq('id', selectedWithdrawal.id);

          toast.error(`Approval complete but transfer failed: ${b2cResult.error}`);
        }
      } else if (anyRejected) {
        await (supabase.from(wTable) as any)
          .update({ status: 'rejected' })
          .eq('id', selectedWithdrawal.id);

        toast.error('Withdrawal rejected');
      } else {
        toast.success(`Withdrawal ${action === 'approve' ? 'approved' : 'rejected'}`);
      }

      setShowApprovalDialog(false);
      setSelectedWithdrawal(null);
      setRejectionReason('');

      await fetchWithdrawals();
    } catch (error) {
      console.error('Error processing approval:', error);
      toast.error('Failed to process approval');
    } finally {
      setProcessing(false);
    }
  };
  const { data: stats } = useQuery({
    queryKey: ["chairperson-stats"],
    queryFn: async () => {
      const [membersRes, paymentsRes, defaultersRes, eventsRes] = await Promise.all([
        supabase.from("members").select("id, is_active").eq("is_active", true),
        supabase.from("payments").select("amount").eq("matched", true),
        supabase.from("members").select("id, name, total_penalties").gt("total_penalties", 0),
        supabase.from("events").select("id").eq("status", "active"),
      ]);

      const totalCollected = paymentsRes.data?.reduce((sum, p) => sum + p.amount, 0) || 0;
      
      return {
        activeMembers: membersRes.data?.length || 0,
        totalCollected,
        defaulters: defaultersRes.data?.length || 0,
        activeEvents: eventsRes.data?.length || 0,
        defaultersList: defaultersRes.data || [],
      };
    },
  });

  const { data: recentPayments } = useQuery({
    queryKey: ["recent-payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select(`
          *,
          members:member_id (name, phone)
        `)
        .eq("matched", true)
        .order("received_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Chairperson Dashboard"
        subtitle="Governance, oversight, and approvals"
        icon={Crown}
        badge="Read Only Access"
      />

      {/* Stats Overview */}
      <GlassStatsGrid
        cols="grid-cols-2 lg:grid-cols-4"
        stats={[
          { label: "Active Members", value: stats?.activeMembers || 0, icon: Users, sub: "Registered", accent: "from-primary/30 to-primary-glow/10" },
          { label: "Total Collected", value: `KES ${(stats?.totalCollected || 0).toLocaleString()}`, icon: TrendingUp, sub: "All time", accent: "from-success/30 to-success/5" },
          { label: "Defaulters", value: stats?.defaulters || 0, icon: AlertTriangle, sub: "Members with penalties", accent: "from-destructive/30 to-destructive/5" },
          { label: "Active Events", value: stats?.activeEvents || 0, icon: Calendar, sub: "Currently open", accent: "from-secondary/30 to-secondary/5" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Defaulters List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Members with Penalties
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.defaultersList?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No members with penalties</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Penalties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats?.defaultersList?.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell className="text-destructive font-medium">
                        KES {Number(member.total_penalties).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Payments */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {recentPayments?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No recent payments</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments?.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        {payment.members?.name || "Unknown"}
                      </TableCell>
                      <TableCell>KES {payment.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        {new Date(payment.received_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Withdrawal Approvals Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Withdrawal Approvals
          </CardTitle>
          <Badge className="bg-blue-100 text-blue-800">
            {getPendingWithdrawals().length} Pending
          </Badge>
        </CardHeader>
        <CardContent>
          {getPendingWithdrawals().length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No pending withdrawals</p>
          ) : (
            <div className="space-y-4">
              {getPendingWithdrawals().map((withdrawal) => (
                <div key={withdrawal.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">KES {withdrawal.amount.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">{withdrawal.reason}</p>
                      {withdrawal.phone_number && (
                        <p className="text-sm text-muted-foreground">Phone: {withdrawal.phone_number}</p>
                      )}
                    </div>
                    <Badge variant="outline">{withdrawal.status}</Badge>
                  </div>

                  {/* Signatory Status */}
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {withdrawal.withdrawal_signatories?.map((sig: any) => (
                      <div key={sig.id} className="flex items-center gap-2">
                        {sig.status === 'approved' ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : sig.status === 'rejected' ? (
                          <XCircle className="h-4 w-4 text-red-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-yellow-600" />
                        )}
                        <span className="capitalize">{sig.signatory_role}</span>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  {withdrawal.withdrawal_signatories?.find(
                    (s: any) => s.signatory_role === 'chairperson' && s.status === 'pending'
                  ) && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedWithdrawal(withdrawal);
                          setApprovalAction('approve');
                          setShowApprovalDialog(true);
                        }}
                        className="flex-1"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedWithdrawal(withdrawal);
                          setApprovalAction('reject');
                          setShowApprovalDialog(true);
                        }}
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' ? 'Approve Withdrawal' : 'Reject Withdrawal'}
            </DialogTitle>
          </DialogHeader>
          {selectedWithdrawal && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-lg font-semibold">KES {selectedWithdrawal.amount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reason</p>
                <p className="text-sm">{selectedWithdrawal.reason}</p>
              </div>
              {approvalAction === 'reject' && (
                <div>
                  <Label>Rejection Reason</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Please provide a reason for rejection..."
                    rows={3}
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowApprovalDialog(false);
                    setSelectedWithdrawal(null);
                    setRejectionReason('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleApproval(approvalAction!)}
                  disabled={processing}
                  className={approvalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                >
                  {processing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                  ) : (
                    approvalAction === 'approve' ? 'Approve' : 'Reject'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}