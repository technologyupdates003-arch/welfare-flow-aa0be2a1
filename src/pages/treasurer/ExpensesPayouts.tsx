import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
const supabase: any = supabaseClient;
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, DollarSign, TrendingDown, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function ExpensesPayouts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");
  const [payoutType, setPayoutType] = useState<"wedding" | "death" | "retirement" | "emergency">("wedding");
  const [deathRelation, setDeathRelation] = useState<"member" | "child" | "parent" | "spouse">("member");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutReason, setPayoutReason] = useState("");
  const [expenseForm, setExpenseForm] = useState({
    expenseType: "operational",
    category: "",
    amount: "",
    description: "",
    recipientName: "",
    paymentMethod: "",
    referenceNumber: "",
  });

  // Fetch organization settings for payout rules
  const { data: orgSettings } = useQuery({
    queryKey: ["organization-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("organization_settings")
        .select("*")
        .single();
      return data;
    },
  });

  // Fetch members for payout dropdown
  const { data: members = [] } = useQuery({
    queryKey: ["members-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select("id, name, phone")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  // Fetch expenses
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch payouts
  const { data: payouts = [] } = useQuery({
    queryKey: ["payouts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payouts")
        .select(`
          *,
          members (name, phone)
        `)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Get eligible amount based on payout type
  const getEligibleAmount = (type: string) => {
    const rules = orgSettings?.payout_rules || {
      wedding: 25000,
      death: 50000,
      death_member: 50000,
      death_spouse: 50000,
      death_child: 50000,
      death_parent: 50000,
      retirement: 30000,
      emergency: 15000,
    };

    if (type.startsWith("death_")) {
      return rules[type as keyof typeof rules] ?? rules["death"] ?? 0;
    }
    if (type === "death") {
      return rules["death_member"] ?? rules["death"] ?? 0;
    }

    return rules[type as keyof typeof rules] ?? 0;
  };

  // Create payout mutation
  const createPayout = useMutation({
    mutationFn: async (data: any) => {
      const eligibleAmount = data.payoutType === "death"
        ? getEligibleAmount(`death_${data.deathRelation}`)
        : getEligibleAmount(data.payoutType);

      const { error } = await supabase
        .from("payouts")
        .insert({
          member_id: data.memberId,
          payout_type: data.payoutType,
          amount: data.amount,
          eligible_amount: eligibleAmount,
          reason: data.reason,
          status: "pending",
          created_by: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payouts"] });
      setPayoutDialogOpen(false);
      toast.success("Payout request created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Approve payout mutation
  const approvePayout = useMutation({
    mutationFn: async (payoutId: string) => {
      const { error } = await supabase
        .from("payouts")
        .update({
          status: "approved",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", payoutId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payouts"] });
      toast.success("Payout approved");
    },
  });

  // Create expense mutation
  const createExpense = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("expenses")
        .insert({
          expense_type: data.expenseType,
          category: data.category,
          amount: data.amount,
          description: data.description,
          recipient_name: data.recipientName,
          payment_method: data.paymentMethod,
          reference_number: data.referenceNumber,
          status: "pending",
          created_by: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setExpenseDialogOpen(false);
      setExpenseForm({
        expenseType: "operational",
        category: "",
        amount: "",
        description: "",
        recipientName: "",
        paymentMethod: "",
        referenceNumber: "",
      });
      toast.success("Expense recorded successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge className="bg-blue-100 text-blue-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case "paid":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  useEffect(() => {
    const amount = payoutType === "death"
      ? getEligibleAmount(`death_${deathRelation}`)
      : getEligibleAmount(payoutType);
    setPayoutAmount(amount.toString());
  }, [payoutType, deathRelation, orgSettings]);

  const eligibleAmount = payoutType === "death"
    ? getEligibleAmount(`death_${deathRelation}`)
    : getEligibleAmount(payoutType);

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex gap-3">
        <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record New Expense</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Expense Type *</Label>
                <Select
                  value={expenseForm.expenseType}
                  onValueChange={(value) => setExpenseForm({ ...expenseForm, expenseType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operational">Operational</SelectItem>
                    <SelectItem value="payout">Payout</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Category *</Label>
                <Input
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  placeholder="e.g., Office Supplies, Transport, etc."
                />
              </div>

              <div>
                <Label>Amount (Ksh) *</Label>
                <Input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder="Enter amount"
                />
              </div>

              <div>
                <Label>Recipient Name</Label>
                <Input
                  value={expenseForm.recipientName}
                  onChange={(e) => setExpenseForm({ ...expenseForm, recipientName: e.target.value })}
                  placeholder="Who received the payment?"
                />
              </div>

              <div>
                <Label>Payment Method</Label>
                <Select
                  value={expenseForm.paymentMethod}
                  onValueChange={(value) => setExpenseForm({ ...expenseForm, paymentMethod: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Reference Number</Label>
                <Input
                  value={expenseForm.referenceNumber}
                  onChange={(e) => setExpenseForm({ ...expenseForm, referenceNumber: e.target.value })}
                  placeholder="Transaction/Receipt number"
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="Add notes about this expense..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setExpenseDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createExpense.mutate(expenseForm)}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                  disabled={!expenseForm.category || !expenseForm.amount || createExpense.isPending}
                >
                  {createExpense.isPending ? "Recording..." : "Record Expense"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <DollarSign className="h-4 w-4 mr-2" />
              Trigger Payout
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Member Payout</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Member Selection */}
              <div>
                <Label>Select Member *</Label>
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name} - {member.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Event Type */}
              <div>
                <Label>Event Type *</Label>
                <Select value={payoutType} onValueChange={(value: any) => setPayoutType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wedding">Wedding</SelectItem>
                    <SelectItem value="death">Death</SelectItem>
                    <SelectItem value="retirement">Retirement</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {payoutType === "death" && (
                <div>
                  <Label>Death Relation *</Label>
                  <Select value={deathRelation} onValueChange={(value: any) => setDeathRelation(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="spouse">Spouse</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Auto-calculated Eligible Amount */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900">Eligible Amount</p>
                    <p className="text-xs text-blue-700 mt-1">Based on {payoutType} {payoutType === "death" ? `(${deathRelation})` : "event"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-900">
                      Ksh {eligibleAmount.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <Label>Payout Amount *</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                />
                <p className="text-xs text-[#6B7280] mt-1">
                  Suggested amount is Ksh {eligibleAmount.toLocaleString()}
                </p>
              </div>

              {/* Reason */}
              <div>
                <Label>Reason / Notes</Label>
                <Textarea
                  value={payoutReason}
                  onChange={(e) => setPayoutReason(e.target.value)}
                  placeholder="Add any additional notes..."
                  rows={3}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setPayoutDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={!selectedMember || !payoutAmount || createPayout.isPending}
                  onClick={() => createPayout.mutate({
                    memberId: selectedMember,
                    payoutType,
                    amount: parseFloat(payoutAmount),
                    reason: payoutReason || `${payoutType === "death" ? `Death payout (${deathRelation})` : `${payoutType.charAt(0).toUpperCase() + payoutType.slice(1)} payout`} `,
                    deathRelation,
                  })}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {createPayout.isPending ? "Creating..." : "Create Payout"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs for Expenses and Payouts */}
      <Tabs defaultValue="payouts" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        {/* Payouts Tab */}
        <TabsContent value="payouts">
          <Card className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-[#111827]">Member Payouts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E5E7EB]">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[#6B7280]">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[#6B7280]">Member</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[#6B7280]">Event Type</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-[#6B7280]">Amount</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-[#6B7280]">Status</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-[#6B7280]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((payout: any) => (
                      <tr key={payout.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F9FAFB]">
                        <td className="py-3 px-4 text-sm text-[#111827]">
                          {new Date(payout.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-sm font-medium text-[#111827]">{payout.members?.name}</p>
                            <p className="text-xs text-[#6B7280]">{payout.members?.phone}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="capitalize">
                            {payout.payout_type}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-medium text-[#111827]">
                          Ksh {parseFloat(payout.amount).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {getStatusBadge(payout.status)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {payout.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => approvePayout.mutate(payout.id)}
                            >
                              Approve
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses">
          <Card className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB]">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-[#111827]">Organizational Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <div className="text-center py-12 text-[#6B7280]">
                  <TrendingDown className="h-12 w-12 mx-auto mb-4 text-[#6B7280]" />
                  <p>No expenses recorded yet</p>
                  <p className="text-sm mt-2">Click "Add Expense" to record a new expense</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E5E7EB]">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#6B7280]">Date</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#6B7280]">Category</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#6B7280]">Type</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-[#6B7280]">Recipient</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-[#6B7280]">Amount</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-[#6B7280]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((expense: any) => (
                        <tr key={expense.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F9FAFB]">
                          <td className="py-3 px-4 text-sm text-[#111827]">
                            {new Date(expense.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-[#111827]">
                            {expense.category}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="capitalize">
                              {expense.expense_type}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-sm text-[#6B7280]">
                            {expense.recipient_name || "-"}
                          </td>
                          <td className="py-3 px-4 text-right text-sm font-medium text-red-600">
                            -Ksh {parseFloat(expense.amount).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {getStatusBadge(expense.status)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
