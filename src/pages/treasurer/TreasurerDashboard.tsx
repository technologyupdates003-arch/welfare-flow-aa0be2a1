import { useQuery } from "@tanstack/react-query";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
const supabase: any = supabaseClient;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, Clock, CheckCircle, XCircle, Sparkles, FileText, Loader2, Banknote } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { GlassStatsGrid } from "@/components/dashboard/GlassStatCard";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { initiateB2CWithdrawal } from "@/lib/b2c";

export default function TreasurerDashboard() {
  const { user } = useAuth();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
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
          .eq('withdrawal_signatories.signatory_role', 'treasurer')
          .eq('withdrawal_signatories.status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('donation_withdrawals')
          .select(`
            id, amount, reason, status, requested_by, submitted_at, created_at, phone_number,
            donation_withdrawal_signatories ( id, signatory_role, status, signature_url, approved_at, rejected_at, signatory_user_id )
          `)
          .eq('donation_withdrawal_signatories.signatory_role', 'treasurer')
          .eq('donation_withdrawal_signatories.status', 'pending')
          .order('created_at', { ascending: false }),
      ]);

      if (penaltyRes.error) throw penaltyRes.error;
      if (donationRes.error) throw donationRes.error;

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

      const combined = [
        ...(penaltyRes.data || []).map((w: any) => ({
          ...w,
          _type: 'penalty' as const,
          signatories: w.withdrawal_signatories?.map((s: any) => ({ ...s, signatureInfo: getSignatureInfo(s) })),
        })),
        ...(donationRes.data || []).map((w: any) => ({
          ...w,
          _type: 'donation' as const,
          withdrawal_signatories: w.donation_withdrawal_signatories,
          signatories: w.donation_withdrawal_signatories?.map((s: any) => ({ ...s, signatureInfo: getSignatureInfo(s) })),
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
      const treasurerSignatory = w.signatories?.find(
        (s: any) => s.signatory_role === 'treasurer' && s.status === 'pending'
      );
      return !!treasurerSignatory;
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

      let mySignatureUrl: string | null = null;
      try {
        const { data: mySig } = await supabase
          .from('signatory_signatures')
          .select('signature_url')
          .eq('user_id', user.id)
          .eq('signatory_role', 'treasurer')
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

      const { error: updateError } = await supabase
        .from(sigTable)
        .update(updatePayload)
        .eq('withdrawal_id', selectedWithdrawal.id)
        .eq('signatory_role', 'treasurer');

      if (updateError) throw updateError;

      const { data: allSignatories } = await supabase
        .from(sigTable)
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
          await supabase
            .from(wTable)
            .update({ status: 'completed', submitted_at: new Date().toISOString() })
            .eq('id', selectedWithdrawal.id);

          toast.success(
            `âœ… Withdrawal completed! KES ${selectedWithdrawal.amount.toLocaleString()} transferred to ${selectedWithdrawal.phone_number}`
          );
        } else {
          await supabase
            .from(wTable)
            .update({ status: 'approved', submitted_at: new Date().toISOString() })
            .eq('id', selectedWithdrawal.id);

          toast.error(`Approval complete but transfer failed: ${b2cResult.error}`);
        }
      } else if (anyRejected) {
        await supabase
          .from(wTable)
          .update({ status: 'rejected' })
          .eq('id', selectedWithdrawal.id);

        toast.error('Withdrawal rejected');
      } else {
        toast.success(`Withdrawal ${action === 'approve' ? 'approved' : 'rejected'} by you`);
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
  // Fetch financial summary â€” aligned with Admin Dashboard StatsCards
  const { data: financialSummary } = useQuery({
    queryKey: ["treasurer-financial-summary"],
    queryFn: async () => {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const monthStart = `${currentYear}-${currentMonth.toString().padStart(2, "0")}-01`;

      // Same source as Admin StatsCards: contributions + penalties tables
      const [allContribsRes, monthContribsRes, penaltiesRes] = await Promise.all([
        supabase.from("contributions").select("amount, status"),
        supabase.from("contributions").select("amount, status").gte("created_at", monthStart),
        supabase.from("penalties").select("amount, is_paid"),
      ]);

      const allContribs = allContribsRes.data || [];
      const monthContribs = monthContribsRes.data || [];
      const penalties = penaltiesRes.data || [];

      const totalCollected = allContribs.filter((c: any) => c.status === "paid").reduce((s, c: any) => s + Number(c.amount), 0);
      const totalExpected = allContribs.reduce((s, c: any) => s + Number(c.amount), 0);
      const outstanding = totalExpected - totalCollected;
      const monthCollected = monthContribs.filter((c: any) => c.status === "paid").reduce((s, c: any) => s + Number(c.amount), 0);
      const totalPenalties = penalties.reduce((s, p: any) => s + Number(p.amount), 0);
      const collectedPenalties = penalties.filter((p: any) => p.is_paid).reduce((s, p: any) => s + Number(p.amount), 0);

      return {
        totalBalance: totalCollected + collectedPenalties, // money in
        totalCollected,
        totalExpected,
        outstanding,
        monthlyContributions: monthCollected,
        monthlyExpenses: 0,
        netBalance: monthCollected,
        totalPenalties,
      };
    },
  });

  // Fetch alerts
  const { data: alerts } = useQuery({
    queryKey: ["treasurer-alerts"],
    queryFn: async () => {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      // Get members with late payments
      const { data: lateMembers } = await supabase
        .from("members")
        .select("id")
        .eq("is_active", true);

      const { data: pendingPayouts } = await supabase
        .from("payouts")
        .select("id")
        .eq("status", "pending");

      const { data: penalties } = await supabase
        .from("penalty_payments")
        .select("id")
        .eq("status", "pending");

      return {
        latePayments: lateMembers?.length || 0,
        pendingPayouts: pendingPayouts?.length || 0,
        pendingPenalties: penalties?.length || 0,
      };
    },
  });

  // Fetch chart data (last 6 months)
  const { data: chartData } = useQuery({
    queryKey: ["treasurer-chart-data"],
    queryFn: async () => {
      const months = [];
      const currentDate = new Date();

      for (let i = 5; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthStart = date.toISOString().split("T")[0];
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split("T")[0];

        const { data: contributions } = await supabase
          .from("contributions")
          .select("amount")
          .eq("status", "paid")
          .gte("created_at", monthStart)
          .lte("created_at", monthEnd);

        const { data: expenses } = await supabase
          .from("expenses")
          .select("amount")
          .eq("status", "paid")
          .gte("created_at", monthStart)
          .lte("created_at", monthEnd);

        months.push({
          month: date.toLocaleDateString("en-US", { month: "short" }),
          income: contributions?.reduce((sum, c) => sum + parseFloat(c.amount), 0) || 0,
          expenses: expenses?.reduce((sum, e) => sum + parseFloat(e.amount), 0) || 0,
        });
      }

      return months;
    },
  });

  // Fetch recent activity
  const { data: recentActivity } = useQuery({
    queryKey: ["treasurer-recent-activity"],
    queryFn: async () => {
      const { data: contributions } = await supabase
        .from("contributions")
        .select(`
          id,
          amount,
          status,
          created_at,
          members (name)
        `)
        .order("created_at", { ascending: false })
        .limit(5);

      return contributions?.map(c => ({
        date: new Date(c.created_at).toLocaleDateString(),
        action: "Contribution",
        member: c.members?.name || "Unknown",
        amount: parseFloat(c.amount),
        status: c.status,
      })) || [];
    },
  });

  // AI Assistant function
  const generateAIResponse = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setAiLoading(true);
    try {
      const response = await generateMockAIResponse(aiPrompt, financialSummary);
      setAiResponse(response);
    } catch (error) {
      toast.error("Failed to generate AI response");
    } finally {
      setAiLoading(false);
    }
  };

  const generateMockAIResponse = async (prompt: string, summary: any): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (prompt.toLowerCase().includes("forecast") || prompt.toLowerCase().includes("predict")) {
      return `ðŸ“Š FINANCIAL FORECAST:

Based on current trends:
- Monthly Average Income: Ksh ${(summary?.monthlyContributions || 0).toLocaleString()}
- Monthly Average Expenses: Ksh ${(summary?.monthlyExpenses || 0).toLocaleString()}
- Net Monthly: Ksh ${(summary?.netBalance || 0).toLocaleString()}

6-MONTH PROJECTION:
- Projected Balance: Ksh ${((summary?.totalBalance || 0) + (summary?.netBalance || 0) * 6).toLocaleString()}
- Risk Factors: Collection delays, unexpected expenses
- Recommendations: Maintain 3-month reserve, accelerate collections`;
    } else if (prompt.toLowerCase().includes("optimize") || prompt.toLowerCase().includes("improve")) {
      return `ðŸ’¡ OPTIMIZATION RECOMMENDATIONS:

1. COLLECTION EFFICIENCY:
   - Implement automated payment reminders
   - Offer multiple payment channels
   - Create incentive program for early payments

2. EXPENSE MANAGEMENT:
   - Review recurring expenses
   - Negotiate better rates with vendors
   - Implement approval workflow

3. CASH FLOW:
   - Establish minimum reserve level
   - Create emergency fund
   - Plan for seasonal variations

4. REPORTING:
   - Generate monthly financial statements
   - Track KPIs consistently
   - Share transparency reports with members`;
    } else {
      return `ðŸ“ˆ DASHBOARD INSIGHTS:

CURRENT FINANCIAL HEALTH:
- Total Balance: Ksh ${(summary?.totalBalance || 0).toLocaleString()}
- This Month Net: Ksh ${(summary?.netBalance || 0).toLocaleString()}
- Collection Rate: Healthy

KEY METRICS:
- Monthly Income: Ksh ${(summary?.monthlyContributions || 0).toLocaleString()}
- Monthly Expenses: Ksh ${(summary?.monthlyExpenses || 0).toLocaleString()}
- Balance Trend: ${(summary?.netBalance || 0) > 0 ? "Positive âœ“" : "Negative âœ—"}

NEXT STEPS:
- Review pending transactions
- Follow up on late payments
- Plan upcoming expenses`;
    }
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Treasurer Dashboard"
        subtitle="Financial oversight, contributions, and approvals"
        icon={Banknote}
        badge="Financial Control"
      />

      {/* AI Assistant Button */}
      <div className="flex justify-end">
        <Dialog open={aiOpen} onOpenChange={setAiOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-brand text-primary-foreground shadow-brand text-sm md:text-base">
              <Sparkles className="h-4 w-4 mr-2" />
              AI Financial Advisor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto w-[95vw] md:w-full">
            <DialogHeader>
              <DialogTitle>AI Financial Advisor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Ask for financial insights</label>
                <Input
                  placeholder="e.g., Forecast next 6 months, How to optimize expenses, What's our financial health..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="mt-2 text-sm"
                />
              </div>
              <Button
                onClick={generateAIResponse}
                disabled={aiLoading}
                className="w-full gradient-brand text-primary-foreground"
              >
                {aiLoading ? "Analyzing..." : "Get Insights"}
              </Button>
              {aiResponse && (
                <div className="glass-brand p-4 rounded-lg border border-primary/30">
                  <p className="text-sm whitespace-pre-wrap">{aiResponse}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => {
                      navigator.clipboard.writeText(aiResponse);
                      toast.success("Copied to clipboard");
                    }}
                  >
                    Copy to Clipboard
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <GlassStatsGrid
        cols="grid-cols-2 lg:grid-cols-4"
        stats={[
          { label: "Total Balance", value: `Ksh ${(financialSummary?.totalBalance || 0).toLocaleString()}`, icon: Wallet, sub: "Updated today", accent: "from-primary/30 to-primary-glow/10" },
          { label: "Contributions (Month)", value: `Ksh ${(financialSummary?.monthlyContributions || 0).toLocaleString()}`, icon: TrendingUp, sub: "Income", accent: "from-success/30 to-success/5", subIcon: TrendingUp },
          { label: "Expenses (Month)", value: `Ksh ${(financialSummary?.monthlyExpenses || 0).toLocaleString()}`, icon: TrendingDown, sub: "Outflow", accent: "from-destructive/30 to-destructive/5", subIcon: TrendingDown },
          { label: "Net Balance", value: `Ksh ${(financialSummary?.netBalance || 0).toLocaleString()}`, icon: TrendingUp, sub: "This month", accent: (financialSummary?.netBalance || 0) >= 0 ? "from-success/30 to-success/5" : "from-destructive/30 to-destructive/5" },
        ]}
      />

      {/* Chart and Alerts Row - More compact */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 md:gap-3">
        {/* Income vs Expenses Chart */}
        <Card className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-[#E5E7EB]">
          <CardHeader className="p-2 md:p-4">
            <CardTitle className="text-base md:text-lg font-bold text-[#111827]">Income vs Expenses</CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-4 pt-0 md:pt-0">
            <div className="h-[250px] md:h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" stroke="#6B7280" style={{ fontSize: "11px" }} />
                  <YAxis stroke="#6B7280" style={{ fontSize: "11px" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #E5E7EB",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={{ fill: "#10B981", r: 4 }}
                    name="Income"
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke="#EF4444"
                    strokeWidth={2}
                    dot={{ fill: "#EF4444", r: 4 }}
                    name="Expenses"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Alerts Panel */}
        <Card className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB]">
          <CardHeader className="p-2 md:p-4">
            <CardTitle className="text-base md:text-lg font-bold text-[#111827] flex items-center gap-2">
              Alerts
              <Badge variant="destructive" className="ml-auto text-xs md:text-sm">
                {(alerts?.latePayments || 0) + (alerts?.pendingPayouts || 0)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-4 pt-0 md:pt-0 space-y-2 md:space-y-3">
            {/* Late Payments Alert */}
            <div className="flex items-start gap-2 md:gap-3 p-2 md:p-3 bg-red-50 rounded-lg border border-red-100">
              <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-red-900 truncate">
                  {alerts?.latePayments || 0} members late payment
                </p>
                <p className="text-xs text-red-700 mt-0.5">Requires follow-up</p>
              </div>
            </div>

            {/* Pending Payouts Alert */}
            <div className="flex items-start gap-2 md:gap-3 p-2 md:p-3 bg-orange-50 rounded-lg border border-orange-100">
              <Clock className="h-4 w-4 md:h-5 md:w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-orange-900 truncate">
                  {alerts?.pendingPayouts || 0} pending payouts
                </p>
                <p className="text-xs text-orange-700 mt-0.5">Awaiting approval</p>
              </div>
            </div>

            {/* Pending Penalties */}
            <div className="flex items-start gap-2 md:gap-3 p-2 md:p-3 bg-yellow-50 rounded-lg border border-yellow-100">
              <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-yellow-900 truncate">
                  {alerts?.pendingPenalties || 0} members under penalty
                </p>
                <p className="text-xs text-yellow-700 mt-0.5">Review required</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Table */}
      <Card className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB]">
        <CardHeader className="p-2 md:p-4">
          <CardTitle className="text-base md:text-lg font-bold text-[#111827]">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-4 pt-0 md:pt-0">
          <div className="overflow-x-auto -mx-3 md:mx-0">
            <table className="w-full text-sm md:text-base">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  <th className="text-left py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm font-semibold text-[#6B7280]">Date</th>
                  <th className="text-left py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm font-semibold text-[#6B7280]">Action</th>
                  <th className="text-left py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm font-semibold text-[#6B7280]">Member</th>
                  <th className="text-right py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm font-semibold text-[#6B7280]">Amount</th>
                  <th className="text-center py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm font-semibold text-[#6B7280]">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity?.map((activity, index) => (
                  <tr key={index} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F9FAFB]">
                    <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-[#111827]">{activity.date}</td>
                    <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-[#111827]">{activity.action}</td>
                    <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-[#111827] truncate">{activity.member}</td>
                    <td className="py-2 md:py-3 px-3 md:px-4 text-xs md:text-sm text-[#111827] text-right font-medium">
                      Ksh {activity.amount.toLocaleString()}
                    </td>
                    <td className="py-2 md:py-3 px-3 md:px-4 text-center">
                      {activity.status === "paid" ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs md:text-sm">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Paid
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs md:text-sm">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Withdrawal Approvals Section */}
      <Card className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB]">
        <CardHeader className="p-2 md:p-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base md:text-lg font-bold text-[#111827] flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Withdrawal Approvals
            </CardTitle>
            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
              {getPendingWithdrawals().length} Pending
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-2 md:p-4 pt-0 md:pt-0">
          {getPendingWithdrawals().length === 0 ? (
            <p className="text-center text-gray-600 py-8">No pending approvals</p>
          ) : (
            <div className="space-y-3">
              {getPendingWithdrawals().map((withdrawal) => (
                <div key={withdrawal.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">KES {withdrawal.amount.toLocaleString()}</p>
                      <p className="text-xs text-gray-600 mt-1">{withdrawal.reason}</p>
                      {withdrawal.phone_number && (
                        <p className="text-xs text-gray-600 mt-1">Transfer to: {withdrawal.phone_number}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          setSelectedWithdrawal(withdrawal);
                          setApprovalAction('approve');
                          setShowApprovalDialog(true);
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
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
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
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
              {approvalAction === 'approve' ? 'Approve' : 'Reject'} Withdrawal
            </DialogTitle>
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

