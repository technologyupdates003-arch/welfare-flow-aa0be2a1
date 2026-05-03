import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export default function PayPenalty() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    reference_number: "",
    payment_date: new Date().toISOString().split("T")[0],
    payment_message: "",
    notes: ""
  });

  const { data: memberInfo } = useQuery({
    queryKey: ["member-info"],
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select("id, name, phone")
        .eq("user_id", user?.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: penaltyPayments = [] } = useQuery({
    queryKey: ["penalty-payments"],
    queryFn: async () => {
      if (!memberInfo?.id) return [];
      const { data } = await supabase
        .from("penalty_payments")
        .select("*")
        .eq("member_id", memberInfo.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!memberInfo?.id,
  });

  const submitPayment = useMutation({
    mutationFn: async () => {
      if (!memberInfo?.id) throw new Error("Member info not found");
      if (!form.amount || !form.reference_number || !form.payment_date) {
        throw new Error("Please fill in all required fields");
      }

      const { error } = await (supabase as any)
        .from("penalty_payments")
        .insert({
          member_id: memberInfo.id,
          amount: parseFloat(form.amount),
          reference_number: form.reference_number,
          payment_date: form.payment_date,
          payment_message: form.payment_message || null,
          notes: form.notes || null,
          status: "pending"
        });

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["penalty-payments"] });
      setPaymentDialogOpen(false);
      setForm({
        amount: "",
        reference_number: "",
        payment_date: new Date().toISOString().split("T")[0],
        payment_message: "",
        notes: ""
      });
      toast.success("Penalty payment submitted for verification");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "verified":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "rejected":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Verified</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending Review</Badge>;
      default:
        return null;
    }
  };

  const totalPending = penaltyPayments
    .filter(p => p.status === "pending")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const totalVerified = penaltyPayments
    .filter(p => p.status === "verified")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <AlertCircle className="h-8 w-8" />
          Pay Penalty
        </h1>
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Submit Payment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Penalty Payment</DialogTitle>
              <DialogDescription>
                Enter your payment details for verification
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Member Name</Label>
                <Input
                  value={memberInfo?.name || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>Amount (KES) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  placeholder="Enter amount"
                />
              </div>
              <div>
                <Label>Reference Number (M-Pesa/Bank) *</Label>
                <Input
                  value={form.reference_number}
                  onChange={e => setForm({ ...form, reference_number: e.target.value })}
                  placeholder="e.g., MJK123456789"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This is the transaction ID from your payment method
                </p>
              </div>
              <div>
                <Label>Payment Date *</Label>
                <Input
                  type="date"
                  value={form.payment_date}
                  onChange={e => setForm({ ...form, payment_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Payment Message (M-Pesa SMS) *</Label>
                <Textarea
                  value={form.payment_message}
                  onChange={e => setForm({ ...form, payment_message: e.target.value })}
                  placeholder="Paste your M-Pesa confirmation message here...&#10;Example: MJK123456789 Confirmed. You have sent Ksh500.00 to WELFARE GROUP..."
                  rows={4}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Copy and paste the entire M-Pesa confirmation SMS you received
                </p>
              </div>
              <div>
                <Label>Additional Notes (Optional)</Label>
                <Textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Any additional information about this payment..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPaymentDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => submitPayment.mutate()}
                  disabled={submitPayment.isPending || !form.amount || !form.reference_number || !form.payment_message}
                  className="flex-1"
                >
                  {submitPayment.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                  ) : (
                    "Submit for Verification"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {totalPending.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {penaltyPayments.filter(p => p.status === "pending").length} payment(s)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Verified Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">KES {totalVerified.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {penaltyPayments.filter(p => p.status === "verified").length} payment(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {penaltyPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No penalty payments submitted yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {penaltyPayments.map((payment: any) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-sm">
                        {new Date(payment.payment_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        KES {parseFloat(payment.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {payment.reference_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(payment.status)}
                          {getStatusBadge(payment.status)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {payment.rejection_reason ? (
                          <div className="text-red-600 dark:text-red-400">
                            {payment.rejection_reason}
                          </div>
                        ) : (
                          payment.notes || "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-sm mb-2">How to Pay Penalty:</h3>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Make payment via M-Pesa or bank transfer</li>
            <li>Click "Submit Payment" and enter the amount</li>
            <li>Enter the transaction reference number (from M-Pesa/bank)</li>
            <li>Admin will verify the payment within 24 hours</li>
            <li>You'll see the status update once verified</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
