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
import { FileText, Download, Plus, Calendar, TrendingUp, DollarSign } from "lucide-react";
import { toast } from "sonner";

export default function TreasurerReports() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reportType, setReportType] = useState<"monthly" | "quarterly" | "annual">("monthly");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState(false);

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

  // Generate report mutation
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

      // Fetch contributions for period
      const { data: contributions } = await supabase
        .from("contributions")
        .select("amount")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      // Fetch expenses for period
      const { data: expenses } = await supabase
        .from("expenses")
        .select("amount")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      // Fetch payouts for period
      const { data: payouts } = await supabase
        .from("payouts")
        .select("amount")
        .eq("status", "paid")
        .gte("paid_at", startDate.toISOString())
        .lte("paid_at", endDate.toISOString());

      const totalContributions = contributions?.reduce((sum, c) => sum + parseFloat(c.amount), 0) || 0;
      const totalExpenses = expenses?.reduce((sum, e) => sum + parseFloat(e.amount), 0) || 0;
      const totalPayouts = payouts?.reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0;
      const netBalance = totalContributions - totalExpenses - totalPayouts;

      // Create report record
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
            payouts_count: payouts?.length || 0,
          },
          generated_by: user?.id,
        });

      if (error) throw error;
      
      setGenerating(false);
      return { totalContributions, totalExpenses, totalPayouts, netBalance };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-reports"] });
      setDialogOpen(false);
      toast.success("Report generated successfully");
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

  const downloadPDF = (report: any) => {
    toast.info("PDF download feature coming soon");
  };

  const downloadExcel = (report: any) => {
    toast.info("Excel download feature coming soon");
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

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadPDF(report)}
                  className="flex-1"
                >
                  <Download className="h-3 w-3 mr-1" />
                  PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadExcel(report)}
                  className="flex-1"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Excel
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
