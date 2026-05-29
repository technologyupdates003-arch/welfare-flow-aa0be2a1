import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
const supabase: any = supabaseClient;
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Plus, Calendar, TrendingUp, DollarSign, Wallet } from "lucide-react";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";

export default function TreasurerReports() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reportType, setReportType] = useState<"monthly" | "quarterly" | "annual">("monthly");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState(false);

  // Fetch org settings for letterhead
  const { data: orgSettings } = useQuery({
    queryKey: ["organization-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("organization_settings").select("*").maybeSingle();
      return data;
    },
  });

  // Fetch existing reports
  const { data: reports = [] } = useQuery({
    queryKey: ["financial-reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("financial_reports")
        .select("*")
        .order("generated_at", { ascending: false });
      return data || [];
    },
  });

  // Generate comprehensive report mutation
  const generateReport = useMutation({
    mutationFn: async (params: any) => {
      setGenerating(true);
      
      // Calculate date range based on report type
      let startDate: Date;
      let endDate: Date;
      
      if (params.reportType === "monthly") {
        startDate = new Date(params.year, params.month - 1, 1);
        endDate = new Date(params.year, params.month, 0);
      } else if (params.reportType === "quarterly") {
        const quarter = Math.ceil(params.month / 3);
        startDate = new Date(params.year, (quarter - 1) * 3, 1);
        endDate = new Date(params.year, quarter * 3, 0);
      } else {
        startDate = new Date(params.year, 0, 1);
        endDate = new Date(params.year, 11, 31);
      }

      // Fetch all contributions
      const { data: contributions } = await supabase
        .from("contributions")
        .select("amount, member_id, created_at")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      // Fetch all expenses
      const { data: expenses } = await supabase
        .from("expenses")
        .select("amount, category, payment_method, created_at")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      // Fetch penalty withdrawals
      const { data: penaltyWithdrawals } = await supabase
        .from("penalty_withdrawals")
        .select("amount, status, created_at")
        .eq("status", "completed")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      // Fetch donation withdrawals
      const { data: donationWithdrawals } = await supabase
        .from("donation_withdrawals")
        .select("amount, status, created_at")
        .eq("status", "completed")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      // Fetch operational withdrawals
      const { data: operationalWithdrawals } = await supabase
        .from("operational_withdrawals")
        .select("amount, status, created_at")
        .eq("status", "completed")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      // Fetch wallet balances
      const { data: penaltyWallet } = await supabase
        .from("penalty_wallet")
        .select("total_balance, total_received, total_withdrawn")
        .single();

      const { data: donationWallet } = await supabase
        .from("donation_wallet")
        .select("total_balance, total_received, total_withdrawn")
        .single();

      const { data: operationalWallet } = await supabase
        .from("operational_wallet")
        .select("total_balance, total_received, total_withdrawn")
        .single();

      // Calculate totals
      const totalContributions = contributions?.reduce((sum, c) => sum + parseFloat(c.amount), 0) || 0;
      const totalExpenses = expenses?.reduce((sum, e) => sum + parseFloat(e.amount), 0) || 0;
      const totalPenaltyPayouts = penaltyWithdrawals?.reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0;
      const totalDonationPayouts = donationWithdrawals?.reduce((sum, d) => sum + parseFloat(d.amount), 0) || 0;
      const totalOperationalPayouts = operationalWithdrawals?.reduce((sum, o) => sum + parseFloat(o.amount), 0) || 0;
      const totalPayouts = totalPenaltyPayouts + totalDonationPayouts + totalOperationalPayouts;
      const netBalance = totalContributions - totalExpenses - totalPayouts;

      // Create comprehensive report record
      const { error } = await supabase
        .from("financial_reports")
        .insert({
          report_type: params.reportType,
          report_period_start: startDate.toISOString().split('T')[0],
          report_period_end: endDate.toISOString().split('T')[0],
          total_contributions: totalContributions,
          total_expenses: totalExpenses,
          total_payouts: totalPayouts,
          net_balance: netBalance,
          report_data: {
            contributions_count: contributions?.length || 0,
            expenses_count: expenses?.length || 0,
            penalty_payouts: totalPenaltyPayouts,
            donation_payouts: totalDonationPayouts,
            operational_payouts: totalOperationalPayouts,
            penalty_wallet_balance: penaltyWallet?.total_balance || 0,
            donation_wallet_balance: donationWallet?.total_balance || 0,
            operational_wallet_balance: operationalWallet?.total_balance || 0,
            penalty_wallet_received: penaltyWallet?.total_received || 0,
            donation_wallet_received: donationWallet?.total_received || 0,
            operational_wallet_received: operationalWallet?.total_received || 0,
            penalty_wallet_withdrawn: penaltyWallet?.total_withdrawn || 0,
            donation_wallet_withdrawn: donationWallet?.total_withdrawn || 0,
            operational_wallet_withdrawn: operationalWallet?.total_withdrawn || 0,
          },
          generated_by: user?.id,
        });

      if (error) throw error;
      
      setGenerating(false);
      return { 
        totalContributions, 
        totalExpenses, 
        totalPayouts, 
        netBalance,
        penaltyWallet,
        donationWallet,
        operationalWallet,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-reports"] });
      setDialogOpen(false);
      toast.success("Comprehensive report generated successfully");
    },
    onError: (error: any) => {
      setGenerating(false);
      toast.error(error.message);
    },
  });

  const handleGenerate = () => {
    generateReport.mutate({
      reportType,
      month: selectedMonth,
      year: selectedYear,
    });
  };

  const downloadPDF = async (report: any) => {
    // Fetch transactions in period with member info (name + phone) instead of raw user ids
    const start = report.report_period_start;
    const end = report.report_period_end + "T23:59:59Z";

    const { data: txs } = await supabase
      .from("wallet_transactions")
      .select("wallet_type, direction, source, party_name, party_phone, gross_amount, net_amount, status, occurred_at, mpesa_receipt")
      .gte("occurred_at", start)
      .lte("occurred_at", end)
      .order("occurred_at", { ascending: false })
      .limit(500);

    // Resolve member full names by phone for any transaction missing a name
    const { data: allMembers } = await supabase.from("members").select("name, phone");
    const normalizePhone = (p: string) => (p || "").replace(/\D/g, "").slice(-9);
    const memberByPhone = new Map(
      (allMembers || []).map((m: any) => [normalizePhone(m.phone), m.name])
    );
    const resolveName = (t: any) =>
      t.party_name || memberByPhone.get(normalizePhone(t.party_phone)) || "—";

    const orgName = orgSettings?.organization_name || "KIRINYAGA HEALTHCARE WORKERS' WELFARE";
    const orgAddress = orgSettings?.organization_address || "P.O.BOX 24-10300 KERUGOYA, LOCATION: KCRH";
    const orgEmail = orgSettings?.organization_email || "Khcww2020@gmail.com";
    const orgPhone = orgSettings?.organization_phone || "+254 712 345 678";
    const logoHtml = orgSettings?.organization_logo
      ? `<img src="${orgSettings.organization_logo}" style="height:60px;width:auto;object-fit:contain;" />`
      : "";
    const signatureHtml = orgSettings?.signature_url
      ? `<div style="margin-top:16px;"><img src="${orgSettings.signature_url}" style="max-height:90px;display:block;"/></div>`
      : "";

    const txRows = (txs || []).map((t: any) => `
      <tr>
        <td style="padding:6px;border:1px solid #E5E7EB;font-size:10px;">${new Date(t.occurred_at).toLocaleDateString()}</td>
        <td style="padding:6px;border:1px solid #E5E7EB;font-size:10px;text-transform:capitalize;">${t.wallet_type}</td>
        <td style="padding:6px;border:1px solid #E5E7EB;font-size:10px;text-transform:uppercase;">${t.source}</td>
        <td style="padding:6px;border:1px solid #E5E7EB;font-size:10px;">${t.party_name || '—'}</td>
        <td style="padding:6px;border:1px solid #E5E7EB;font-size:10px;">${t.party_phone || '—'}</td>
        <td style="padding:6px;border:1px solid #E5E7EB;font-size:10px;text-align:right;color:${t.direction === 'in' ? '#16A34A' : '#DC2626'};">${t.direction === 'in' ? '+' : '-'} Ksh ${Number(t.net_amount || 0).toLocaleString()}</td>
        <td style="padding:6px;border:1px solid #E5E7EB;font-size:10px;">${t.mpesa_receipt || '—'}</td>
      </tr>`).join("");

    const element = document.createElement("div");
    element.innerHTML = `
      <div style="font-family:'Times New Roman',Times,serif;padding:24px;max-width:900px;background:#fff;">
        <div style="border-bottom:4px solid #f97316;padding-bottom:12px;margin-bottom:18px;display:flex;align-items:center;gap:16px;">
          ${logoHtml}
          <div>
            <h1 style="margin:0;font-size:18px;font-weight:bold;color:#111827;">${orgName}</h1>
            <p style="margin:4px 0 0;font-size:11px;color:#6b7280;">${orgAddress}</p>
            <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">Email: ${orgEmail} | Tel: ${orgPhone}</p>
          </div>
        </div>
        <p style="text-align:center;font-size:11px;font-weight:bold;color:#f97316;letter-spacing:3px;margin:0 0 16px;">KHCWW FINANCIAL REPORT</p>

        <h2 style="font-size:15px;font-weight:bold;color:#111827;margin:0 0 6px;">${getReportTitle(report)}</h2>
        <p style="font-size:11px;color:#6b7280;margin:0 0 18px;">Period: ${new Date(report.report_period_start).toLocaleDateString()} - ${new Date(report.report_period_end).toLocaleDateString()}</p>

        <h3 style="color:#111827;border-bottom:1px solid #E5E7EB;padding-bottom:8px;font-size:13px;">Summary</h3>
        <table style="width:100%;border-collapse:collapse;margin:10px 0 20px;">
          <tr style="background:#F9FAFB;"><td style="padding:8px;border:1px solid #E5E7EB;font-weight:bold;font-size:11px;">Total Contributions</td><td style="padding:8px;border:1px solid #E5E7EB;text-align:right;color:#16A34A;font-size:11px;">+ Ksh ${parseFloat(report.total_contributions).toLocaleString()}</td></tr>
          <tr><td style="padding:8px;border:1px solid #E5E7EB;font-weight:bold;font-size:11px;">Total Expenses</td><td style="padding:8px;border:1px solid #E5E7EB;text-align:right;color:#DC2626;font-size:11px;">- Ksh ${parseFloat(report.total_expenses).toLocaleString()}</td></tr>
          <tr style="background:#F9FAFB;"><td style="padding:8px;border:1px solid #E5E7EB;font-weight:bold;font-size:11px;">Total Payouts</td><td style="padding:8px;border:1px solid #E5E7EB;text-align:right;color:#DC2626;font-size:11px;">- Ksh ${parseFloat(report.total_payouts).toLocaleString()}</td></tr>
          <tr style="background:#EFF6FF;font-weight:bold;"><td style="padding:8px;border:1px solid #E5E7EB;font-size:12px;">Net Balance</td><td style="padding:8px;border:1px solid #E5E7EB;text-align:right;font-size:12px;color:${parseFloat(report.net_balance) >= 0 ? '#16A34A' : '#DC2626'};">Ksh ${parseFloat(report.net_balance).toLocaleString()}</td></tr>
        </table>

        <h3 style="color:#111827;border-bottom:1px solid #E5E7EB;padding-bottom:8px;font-size:13px;">Wallet Balances</h3>
        <table style="width:100%;border-collapse:collapse;margin:10px 0 20px;">
          <tr style="background:#F9FAFB;"><th style="padding:8px;border:1px solid #E5E7EB;text-align:left;font-size:11px;">Wallet</th><th style="padding:8px;border:1px solid #E5E7EB;text-align:right;font-size:11px;">Received</th><th style="padding:8px;border:1px solid #E5E7EB;text-align:right;font-size:11px;">Withdrawn</th><th style="padding:8px;border:1px solid #E5E7EB;text-align:right;font-size:11px;">Balance</th></tr>
          <tr><td style="padding:8px;border:1px solid #E5E7EB;font-weight:bold;font-size:11px;">Penalty</td><td style="padding:8px;border:1px solid #E5E7EB;text-align:right;font-size:11px;">Ksh ${(report.report_data?.penalty_wallet_received || 0).toLocaleString()}</td><td style="padding:8px;border:1px solid #E5E7EB;text-align:right;font-size:11px;">Ksh ${(report.report_data?.penalty_wallet_withdrawn || 0).toLocaleString()}</td><td style="padding:8px;border:1px solid #E5E7EB;text-align:right;font-weight:bold;font-size:11px;">Ksh ${(report.report_data?.penalty_wallet_balance || 0).toLocaleString()}</td></tr>
          <tr style="background:#F9FAFB;"><td style="padding:8px;border:1px solid #E5E7EB;font-weight:bold;font-size:11px;">Fund Drive</td><td style="padding:8px;border:1px solid #E5E7EB;text-align:right;font-size:11px;">Ksh ${(report.report_data?.donation_wallet_received || 0).toLocaleString()}</td><td style="padding:8px;border:1px solid #E5E7EB;text-align:right;font-size:11px;">Ksh ${(report.report_data?.donation_wallet_withdrawn || 0).toLocaleString()}</td><td style="padding:8px;border:1px solid #E5E7EB;text-align:right;font-weight:bold;font-size:11px;">Ksh ${(report.report_data?.donation_wallet_balance || 0).toLocaleString()}</td></tr>
          <tr><td style="padding:8px;border:1px solid #E5E7EB;font-weight:bold;font-size:11px;">Operational</td><td style="padding:8px;border:1px solid #E5E7EB;text-align:right;font-size:11px;">Ksh ${(report.report_data?.operational_wallet_received || 0).toLocaleString()}</td><td style="padding:8px;border:1px solid #E5E7EB;text-align:right;font-size:11px;">Ksh ${(report.report_data?.operational_wallet_withdrawn || 0).toLocaleString()}</td><td style="padding:8px;border:1px solid #E5E7EB;text-align:right;font-weight:bold;font-size:11px;">Ksh ${(report.report_data?.operational_wallet_balance || 0).toLocaleString()}</td></tr>
        </table>

        <h3 style="color:#111827;border-bottom:1px solid #E5E7EB;padding-bottom:8px;font-size:13px;">Transactions (${(txs || []).length})</h3>
        <table style="width:100%;border-collapse:collapse;margin:10px 0;">
          <tr style="background:#F9FAFB;">
            <th style="padding:6px;border:1px solid #E5E7EB;text-align:left;font-size:10px;">Date</th>
            <th style="padding:6px;border:1px solid #E5E7EB;text-align:left;font-size:10px;">Wallet</th>
            <th style="padding:6px;border:1px solid #E5E7EB;text-align:left;font-size:10px;">Source</th>
            <th style="padding:6px;border:1px solid #E5E7EB;text-align:left;font-size:10px;">Member Name</th>
            <th style="padding:6px;border:1px solid #E5E7EB;text-align:left;font-size:10px;">Phone</th>
            <th style="padding:6px;border:1px solid #E5E7EB;text-align:right;font-size:10px;">Amount</th>
            <th style="padding:6px;border:1px solid #E5E7EB;text-align:left;font-size:10px;">M-Pesa Ref</th>
          </tr>
          ${txRows || `<tr><td colspan="7" style="padding:14px;text-align:center;font-size:11px;color:#6b7280;border:1px solid #E5E7EB;">No transactions in this period</td></tr>`}
        </table>

        <div style="margin-top:40px;padding-top:14px;border-top:2px solid #111827;display:flex;justify-content:space-between;align-items:flex-end;gap:18px;">
          <div style="max-width:280px;">
            <p style="margin:0;font-size:11px;font-weight:bold;">Treasurer</p>
            <p style="margin:4px 0 0;font-size:10px;color:#6b7280;">Authorized by Treasurer</p>
            ${signatureHtml}
          </div>
          <div style="font-size:10px;color:#6b7280;text-align:right;">Generated: ${new Date().toLocaleString()}</div>
        </div>

        <div style="margin-top:20px;text-align:center;font-size:9px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:10px;">
          <div style="font-weight:bold;">${orgName}</div>
          <div>${orgAddress}</div>
          <div>Email: ${orgEmail} | Tel: ${orgPhone}</div>
        </div>
      </div>
    `;

    const opt = {
      margin: 10,
      filename: `KHCWW_Report_${report.report_period_start}_to_${report.report_period_end}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { orientation: 'portrait' as const, unit: 'mm' as const, format: 'a4' },
    };

    document.body.appendChild(element);
    await html2pdf().set(opt).from(element).save();
    document.body.removeChild(element);
    toast.success("PDF downloaded successfully");
  };




  const getReportTitle = (report: any) => {
    const start = new Date(report.report_period_start);
    const end = new Date(report.report_period_end);
    
    if (report.report_type === "monthly") {
      return `${start.toLocaleString('default', { month: 'long', year: 'numeric' })} Report`;
    } else if (report.report_type === "quarterly") {
      const quarter = Math.ceil((start.getMonth() + 1) / 3);
      return `Q${quarter} ${start.getFullYear()} Report`;
    } else {
      return `${start.getFullYear()} Annual Report`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[#111827]">Financial Reports</h2>
          <p className="text-sm text-[#6B7280] mt-1">
            Generate and download financial reports for different periods
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Financial Report</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Report Type</Label>
                <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly Report</SelectItem>
                    <SelectItem value="quarterly">Quarterly Report</SelectItem>
                    <SelectItem value="annual">Annual Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {reportType !== "annual" && (
                <div>
                  <Label>Month</Label>
                  <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                        <SelectItem key={month} value={month.toString()}>
                          {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Year</Label>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="flex-1"
                  disabled={generating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerate}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                  disabled={generating}
                >
                  {generating ? "Generating..." : "Generate"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report: any) => (
          <Card key={report.id} className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <FileText className="h-10 w-10 text-[#2563EB]" />
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full capitalize">
                  {report.report_type}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-[#111827] mb-1">
                  {getReportTitle(report)}
                </h3>
                <p className="text-xs text-[#6B7280]">
                  Generated {new Date(report.generated_at).toLocaleDateString()}
                </p>
              </div>

              {/* Summary Stats */}
              <div className="space-y-2 py-3 border-y border-[#E5E7EB]">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#6B7280]">Contributions</span>
                  <span className="text-sm font-semibold text-green-600">
                    +Ksh {parseFloat(report.total_contributions).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#6B7280]">Expenses</span>
                  <span className="text-sm font-semibold text-red-600">
                    -Ksh {parseFloat(report.total_expenses).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#6B7280]">Payouts</span>
                  <span className="text-sm font-semibold text-red-600">
                    -Ksh {parseFloat(report.total_payouts).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-[#E5E7EB]">
                  <span className="text-sm font-semibold text-[#111827]">Net Balance</span>
                  <span className={`text-sm font-bold ${parseFloat(report.net_balance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    Ksh {parseFloat(report.net_balance).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Wallet Balances */}
              <div className="space-y-2 py-3 border-y border-[#E5E7EB]">
                <p className="text-xs font-semibold text-[#111827] mb-2">Wallet Balances</p>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#6B7280]">Penalty</span>
                  <span className="font-semibold text-[#111827]">Ksh {(report.report_data?.penalty_wallet_balance || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#6B7280]">Fund Drive</span>
                  <span className="font-semibold text-[#111827]">Ksh {(report.report_data?.donation_wallet_balance || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#6B7280]">Operational</span>
                  <span className="font-semibold text-[#111827]">Ksh {(report.report_data?.operational_wallet_balance || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadPDF(report)}
                  className="flex-1"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {reports.length === 0 && (
        <Card className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB]">
          <CardContent className="text-center py-12">
            <FileText className="h-16 w-16 text-[#6B7280] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#111827] mb-2">No Reports Generated</h3>
            <p className="text-sm text-[#6B7280] mb-4">
              Click "Generate Report" to create your first financial report
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
