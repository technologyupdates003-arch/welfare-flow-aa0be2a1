import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

interface WalletSummary {
  wallet_type: string;
  total_in: number;
  total_out: number;
  balance: number;
  transaction_count: number;
}

interface TransactionSummary {
  source: string;
  count: number;
  total_amount: number;
  avg_amount: number;
}

export default function WalletReports() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dateFrom, setDateFrom] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [walletType, setWalletType] = useState<"all" | "penalty" | "donation" | "operational">("all");
  const [transactionType, setTransactionType] = useState<"all" | "in" | "out">("all");
  const [status, setStatus] = useState<"all" | "completed" | "pending" | "failed">("all");

  const [walletSummaries, setWalletSummaries] = useState<WalletSummary[]>([]);
  const [transactionSummaries, setTransactionSummaries] = useState<TransactionSummary[]>([]);
  const [totalStats, setTotalStats] = useState({
    total_in: 0,
    total_out: 0,
    net_position: 0,
    transaction_count: 0,
    avg_transaction: 0,
  });

  // Fetch report data
  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true);

        // Build wallet query
        let walletQuery = supabase
          .from("wallet_transactions")
          .select("wallet_type, direction, net_amount, source, status");

        if (walletType !== "all") {
          walletQuery = walletQuery.eq("wallet_type", walletType);
        }
        if (transactionType !== "all") {
          walletQuery = walletQuery.eq("direction", transactionType);
        }
        if (status !== "all") {
          walletQuery = walletQuery.eq("status", status);
        }

        walletQuery = walletQuery
          .gte("occurred_at", `${dateFrom}T00:00:00Z`)
          .lte("occurred_at", `${dateTo}T23:59:59Z`);

        const { data: transactions, error } = await walletQuery;

        if (error) throw error;

        // Calculate wallet summaries
        const summaryMap = new Map<string, WalletSummary>();
        let totalIn = 0;
        let totalOut = 0;
        let totalCount = 0;

        (transactions || []).forEach((tx: any) => {
          const key = tx.wallet_type;
          if (!summaryMap.has(key)) {
            summaryMap.set(key, {
              wallet_type: key,
              total_in: 0,
              total_out: 0,
              balance: 0,
              transaction_count: 0,
            });
          }

          const summary = summaryMap.get(key)!;
          if (tx.direction === "in") {
            summary.total_in += tx.net_amount || 0;
            totalIn += tx.net_amount || 0;
          } else {
            summary.total_out += tx.net_amount || 0;
            totalOut += tx.net_amount || 0;
          }
          summary.balance = summary.total_in - summary.total_out;
          summary.transaction_count += 1;
          totalCount += 1;
        });

        setWalletSummaries(Array.from(summaryMap.values()));

        // Calculate transaction type summaries
        const txSummaryMap = new Map<string, TransactionSummary>();
        (transactions || []).forEach((tx: any) => {
          const key = tx.source;
          if (!txSummaryMap.has(key)) {
            txSummaryMap.set(key, {
              source: key,
              count: 0,
              total_amount: 0,
              avg_amount: 0,
            });
          }

          const summary = txSummaryMap.get(key)!;
          summary.count += 1;
          summary.total_amount += tx.net_amount || 0;
          summary.avg_amount = summary.total_amount / summary.count;
        });

        setTransactionSummaries(Array.from(txSummaryMap.values()));

        // Set total stats
        setTotalStats({
          total_in: totalIn,
          total_out: totalOut,
          net_position: totalIn - totalOut,
          transaction_count: totalCount,
          avg_transaction: totalCount > 0 ? (totalIn + totalOut) / totalCount : 0,
        });
      } catch (error) {
        console.error("Error fetching report data:", error);
        toast.error("Failed to load report data");
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [dateFrom, dateTo, walletType, transactionType, status]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Export to PDF
  const exportPDF = async () => {
    try {
      setExporting(true);
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;

      // Header
      doc.setFontSize(16);
      doc.text("Wallet Reports", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 10;

      doc.setFontSize(10);
      doc.text(
        `Period: ${dateFrom} to ${dateTo}`,
        pageWidth / 2,
        yPosition,
        { align: "center" }
      );
      yPosition += 10;

      // Summary Stats
      doc.setFontSize(12);
      doc.text("Summary", 20, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      const stats = [
        `Total In: ${formatCurrency(totalStats.total_in)}`,
        `Total Out: ${formatCurrency(totalStats.total_out)}`,
        `Net Position: ${formatCurrency(totalStats.net_position)}`,
        `Transactions: ${totalStats.transaction_count}`,
      ];

      stats.forEach((stat) => {
        doc.text(stat, 25, yPosition);
        yPosition += 6;
      });

      yPosition += 5;

      // Wallet Summaries Table
      if (walletSummaries.length > 0) {
        doc.setFontSize(12);
        doc.text("Wallet Summaries", 20, yPosition);
        yPosition += 8;

        doc.setFontSize(9);
        const tableData = walletSummaries.map((w) => [
          w.wallet_type,
          formatCurrency(w.total_in),
          formatCurrency(w.total_out),
          formatCurrency(w.balance),
          w.transaction_count.toString(),
        ]);

        (doc as any).autoTable({
          head: [["Wallet", "Total In", "Total Out", "Balance", "Count"]],
          body: tableData,
          startY: yPosition,
          margin: { left: 20, right: 20 },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;
      }

      // Transaction Summaries Table
      if (transactionSummaries.length > 0 && yPosition < pageHeight - 40) {
        doc.setFontSize(12);
        doc.text("Transaction Summaries", 20, yPosition);
        yPosition += 8;

        doc.setFontSize(9);
        const txTableData = transactionSummaries.map((t) => [
          t.source,
          t.count.toString(),
          formatCurrency(t.total_amount),
          formatCurrency(t.avg_amount),
        ]);

        (doc as any).autoTable({
          head: [["Source", "Count", "Total", "Average"]],
          body: txTableData,
          startY: yPosition,
          margin: { left: 20, right: 20 },
        });
      }

      doc.save(`wallet-report-${dateFrom}-to-${dateTo}.pdf`);
      toast.success("PDF exported successfully");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Failed to export PDF");
    } finally {
      setExporting(false);
    }
  };

  // Export to Excel
  const exportExcel = async () => {
    try {
      setExporting(true);
      const workbook = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ["Wallet Reports"],
        [`Period: ${dateFrom} to ${dateTo}`],
        [],
        ["Summary Statistics"],
        ["Total In", formatCurrency(totalStats.total_in)],
        ["Total Out", formatCurrency(totalStats.total_out)],
        ["Net Position", formatCurrency(totalStats.net_position)],
        ["Transaction Count", totalStats.transaction_count],
        ["Average Transaction", formatCurrency(totalStats.avg_transaction)],
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

      // Wallet summaries sheet
      if (walletSummaries.length > 0) {
        const walletData = [
          ["Wallet Type", "Total In", "Total Out", "Balance", "Transaction Count"],
          ...walletSummaries.map((w) => [
            w.wallet_type,
            w.total_in,
            w.total_out,
            w.balance,
            w.transaction_count,
          ]),
        ];

        const walletSheet = XLSX.utils.aoa_to_sheet(walletData);
        XLSX.utils.book_append_sheet(workbook, walletSheet, "Wallets");
      }

      // Transaction summaries sheet
      if (transactionSummaries.length > 0) {
        const txData = [
          ["Source", "Count", "Total Amount", "Average Amount"],
          ...transactionSummaries.map((t) => [
            t.source,
            t.count,
            t.total_amount,
            t.avg_amount,
          ]),
        ];

        const txSheet = XLSX.utils.aoa_to_sheet(txData);
        XLSX.utils.book_append_sheet(workbook, txSheet, "Transactions");
      }

      XLSX.writeFile(workbook, `wallet-report-${dateFrom}-to-${dateTo}.xlsx`);
      toast.success("Excel exported successfully");
    } catch (error) {
      console.error("Error exporting Excel:", error);
      toast.error("Failed to export Excel");
    } finally {
      setExporting(false);
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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Wallet Reports</h1>
        <p className="text-gray-600 mt-2">
          Comprehensive analysis of all wallet transactions
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">From Date</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">To Date</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Wallet Type</label>
              <Select value={walletType} onValueChange={(v: any) => setWalletType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Wallets</SelectItem>
                  <SelectItem value="penalty">Penalty</SelectItem>
                  <SelectItem value="donation">Donation</SelectItem>
                  <SelectItem value="operational">Operational</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Transaction Type</label>
              <Select value={transactionType} onValueChange={(v: any) => setTransactionType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="in">Inbound</SelectItem>
                  <SelectItem value="out">Outbound</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(totalStats.total_in)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Out
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(totalStats.total_out)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Net Position
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                totalStats.net_position >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(totalStats.net_position)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {totalStats.transaction_count}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Avg Transaction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">
              {formatCurrency(totalStats.avg_transaction)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Wallet Summaries */}
      {walletSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Wallet Summaries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {walletSummaries.map((wallet) => (
                <div
                  key={wallet.wallet_type}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-semibold capitalize">{wallet.wallet_type}</p>
                    <p className="text-sm text-gray-600">
                      {wallet.transaction_count} transactions
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm">
                      <span className="text-gray-600">In: </span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(wallet.total_in)}
                      </span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-600">Out: </span>
                      <span className="font-semibold text-red-600">
                        {formatCurrency(wallet.total_out)}
                      </span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-600">Balance: </span>
                      <span
                        className={`font-semibold ${
                          wallet.balance >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(wallet.balance)}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Summaries */}
      {transactionSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Transaction Summaries by Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transactionSummaries.map((tx) => (
                <div
                  key={tx.source}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <Badge variant="outline" className="capitalize mb-2">
                      {tx.source}
                    </Badge>
                    <p className="text-sm text-gray-600">{tx.count} transactions</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm">
                      <span className="text-gray-600">Total: </span>
                      <span className="font-semibold">
                        {formatCurrency(tx.total_amount)}
                      </span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-600">Average: </span>
                      <span className="font-semibold">
                        {formatCurrency(tx.avg_amount)}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={exportPDF}
          disabled={exporting}
          variant="outline"
          className="flex-1"
        >
          <FileText className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
        <Button
          onClick={exportExcel}
          disabled={exporting}
          variant="outline"
          className="flex-1"
        >
          <Download className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>
    </div>
  );
}
