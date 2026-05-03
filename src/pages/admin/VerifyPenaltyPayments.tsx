import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Loader2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export default function VerifyPenaltyPayments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: pendingPayments = [] } = useQuery({
    queryKey: ["pending-penalty-payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("penalty_payments")
        .select(`
          *,
          members(name, phone)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ["all-penalty-payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("penalty_payments")
        .select(`
          *,
          members(name, phone)
        `)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const verifyPayment = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("penalty_payments")
        .update({
          status: "verified",
          verified_by: user?.id,
          verified_at: new Date().toISOString()
        })
        .eq("id", paymentId);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-penalty-payments"] });
      queryClient.invalidateQueries({ queryKey: ["all-penalty-payments"] });
      setVerifyDialogOpen(false);
      setSelectedPayment(null);
      toast.success("Payment verified successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectPayment = useMutation({
    mutationFn: async (paymentId: string) => {
      if (!rejectionReason.trim()) {
        throw new Error("Please provide a rejection reason");
      }

      const { error } = await supabase
        .from("penalty_payments")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason,
          verified_by: user?.id,
          verified_at: new Date().toISOString()
        })
        .eq("id", paymentId);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-penalty-payments"] });
      queryClient.invalidateQueries({ queryKey: ["all-penalty-payments"] });
      setRejectDialogOpen(false);
      setSelectedPayment(null);
      setRejectionReason("");
      toast.success("Payment rejected with reason");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Verified</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return null;
    }
  };

  const totalPending = pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalVerified = allPayments
    .filter(p => p.status === "verified")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <CheckCircle className="h-8 w-8" />
          Verify Penalty Payments
        </h1>
        <Badge variant="secondary" className="text-lg px-3 py-1">
          {pendingPayments.length} Pending
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingPayments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              KES {totalPending.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Verified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {allPayments.filter(p => p.status === "verified").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              KES {totalVerified.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {allPayments.filter(p => p.status === "rejected").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total submissions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Verification</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending payments to verify
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Payment Message</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingPayments.map((payment: any) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        <div>
                          <p>{payment.members?.name}</p>
                          <p className="text-xs text-muted-foreground">{payment.members?.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold">
                        KES {parseFloat(payment.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {payment.reference_number}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(payment.payment_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(payment.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs">
                        <div className="max-w-xs truncate font-mono text-xs">
                          {payment.payment_message || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Dialog open={verifyDialogOpen && selectedPayment?.id === payment.id} onOpenChange={setVerifyDialogOpen}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => setSelectedPayment(payment)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Verify
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Verify Payment</DialogTitle>
                                <DialogDescription>
                                  Confirm this payment has been received
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <p className="text-sm font-medium mb-1">Member</p>
                                  <p className="text-sm text-muted-foreground">{selectedPayment?.members?.name}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium mb-1">Amount</p>
                                  <p className="text-lg font-bold">KES {parseFloat(selectedPayment?.amount).toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium mb-1">Reference Number</p>
                                  <p className="text-sm font-mono">{selectedPayment?.reference_number}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium mb-1">Payment Date</p>
                                  <p className="text-sm">{new Date(selectedPayment?.payment_date).toLocaleDateString()}</p>
                                </div>
                                {selectedPayment?.payment_message && (
                                  <div>
                                    <p className="text-sm font-medium mb-1">Payment Message</p>
                                    <div className="p-3 bg-muted rounded-lg border">
                                      <p className="text-sm font-mono whitespace-pre-wrap">{selectedPayment.payment_message}</p>
                                    </div>
                                  </div>
                                )}
                                {selectedPayment?.notes && (
                                  <div>
                                    <p className="text-sm font-medium mb-1">Additional Notes</p>
                                    <p className="text-sm text-muted-foreground">{selectedPayment.notes}</p>
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => setVerifyDialogOpen(false)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                    onClick={() => verifyPayment.mutate(selectedPayment.id)}
                                    disabled={verifyPayment.isPending}
                                  >
                                    {verifyPayment.isPending ? (
                                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying...</>
                                    ) : (
                                      <>
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Confirm Verification
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Dialog open={rejectDialogOpen && selectedPayment?.id === payment.id} onOpenChange={setRejectDialogOpen}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => {
                                  setSelectedPayment(payment);
                                  setRejectionReason("");
                                }}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Reject Payment</DialogTitle>
                                <DialogDescription>
                                  Provide a reason for rejection
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <p className="text-sm font-medium mb-1">Member</p>
                                  <p className="text-sm text-muted-foreground">{selectedPayment?.members?.name}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium mb-1">Amount</p>
                                  <p className="text-lg font-bold">KES {parseFloat(selectedPayment?.amount).toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium mb-1">Rejection Reason *</p>
                                  <Textarea
                                    value={rejectionReason}
                                    onChange={e => setRejectionReason(e.target.value)}
                                    placeholder="Explain why this payment is being rejected..."
                                    rows={4}
                                  />
                                  <p className="text-xs text-muted-foreground mt-1">
                                    The member will see this reason
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => setRejectDialogOpen(false)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    className="flex-1"
                                    onClick={() => rejectPayment.mutate(selectedPayment.id)}
                                    disabled={rejectPayment.isPending || !rejectionReason.trim()}
                                  >
                                    {rejectPayment.isPending ? (
                                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Rejecting...</>
                                    ) : (
                                      <>
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Reject Payment
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Payments History */}
      <Card>
        <CardHeader>
          <CardTitle>All Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {allPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No penalty payments recorded
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead>Verified Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allPayments.map((payment: any) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        <div>
                          <p>{payment.members?.name}</p>
                          <p className="text-xs text-muted-foreground">{payment.members?.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold">
                        KES {parseFloat(payment.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {payment.reference_number}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(payment.status)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(payment.payment_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {payment.verified_at ? new Date(payment.verified_at).toLocaleDateString() : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
